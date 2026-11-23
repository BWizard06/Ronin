import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { installImageBitmapStandIn } from './support/image-bitmap.mjs';
import { PROP_URLS, parseSceneAsset, loadSceneAsset, resources, replaceChildren, releaseRetired } from '../src/scripts/scene-assets.ts';
import { createCulturalWorld } from '../src/scripts/cultural-world.ts';
import { parseKatanaAsset, installKatanaAsset } from '../src/scripts/katana-asset.ts';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';
import { inspectionFrame } from '../src/scripts/inspection.mjs';
installImageBitmapStandIn();
const read = name => readFileSync(new URL(`../public${PROP_URLS[name]}`, import.meta.url));
const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const load = name => parseSceneAsset(buffer(read(name)));

test('the three shipped props decode with embedded PBR textures and bounded geometry', async () => {
  let total = 0;
  for (const [name, budget] of [['torii',23000],['sakura',39000],['saya',55000]]) {
    const bytes = read(name); total += bytes.length;
    const manifest = JSON.parse(bytes.subarray(20,20 + bytes.readUInt32LE(12)));
    assert.ok(manifest.extensionsRequired.includes('EXT_meshopt_compression'));
    assert.equal(manifest.scenes.length, 1);
    assert.ok(manifest.images.every(image => image.bufferView !== undefined && !image.uri));
    const asset = await load(name); let triangles = 0;
    assert.ok(asset.textures.length >= (name === 'saya' ? 1 : 3));
    for (const texture of asset.textures) assert.ok(texture.image.width <= 2048 && texture.image.height <= 2048);
    asset.root.traverse(mesh => {
      if (!(mesh instanceof THREE.Mesh)) return;
      triangles += mesh.geometry.index.count / 3;
      for (const key of ['position','normal']) assert.ok(Array.from(mesh.geometry.getAttribute(key).array).every(Number.isFinite));
      const material=mesh.material;
      if(material.map || material.normalMap) assert.ok(mesh.geometry.getAttribute('uv'),'textured surface needs UV coordinates');
      if(mesh.geometry.getAttribute('uv'))assert.ok(Array.from(mesh.geometry.getAttribute('uv').array).every(Number.isFinite));
      assert.ok(Array.from(mesh.geometry.index.array).every(index => index < mesh.geometry.getAttribute('position').count));
    });
    assert.ok(triangles > 20000 && triangles <= budget, `${name}: ${triangles}`);
    releaseRetired(asset.root);
  }
  assert.ok(total < 5_000_000, `combined download: ${total}`);
});

test('new cultural models retain opacity, place blossoms on branches, and freeze reduced motion', async () => {
  const world = createCulturalWorld();
  const input = { progress:.87,time:0,reduced:true,pointerX:.5,pointerY:.5,viewport:{x:0,y:0,height:8,aspect:1.6},swordMatrix:new THREE.Matrix4() };
  world.update(input, .4);
  world.installTorii(await load('torii')); world.installSakura(await load('sakura'));
  assert.equal(world.root.getObjectByName('Torii').userData.asset, 'tripo');
  assert.equal(world.root.getObjectByName('CherryBranches').userData.asset, 'tripo');
  assert.ok(world.textures.length >= 6);
  let anchors; world.root.traverse(object => { if (object.userData.blossomAnchors) anchors = object.userData.blossomAnchors; });
  const petals = world.root.getObjectByName('SakuraPetals'), matrix = new THREE.Matrix4(), position = new THREE.Vector3();
  assert.equal(petals.count, anchors.length / 3 * 20);
  for (let i = 0; i < petals.count; i++) {
    petals.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    const anchor = new THREE.Vector3().fromArray(anchors, Math.floor(i / 20) * 3);
    assert.ok(position.distanceTo(anchor) < .016, 'blossom detached from its branch anchor');
  }
  for (const material of resources(world.root).materials) assert.ok(material.opacity === 1 || material.opacity === .09, 'model layers must stay opaque during travel');
  world.update(input, 1);
  const falling = world.root.getObjectByName('FallingPetals'), still = falling.instanceMatrix.array.slice();
  world.update({...input,time:100}, 1); assert.deepEqual(falling.instanceMatrix.array, still);
  world.update({...input,time:100,reduced:false}, 1); assert.notDeepEqual(falling.instanceMatrix.array, still);
  for (const [w,h] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080],[844,390]]) {
    const compact=w < 700, aspect=w/h, height=8;
    world.update({...input,time:25,reduced:false,compact,viewport:{x:0,y:0,height,aspect}},1,.85);
    world.root.updateMatrixWorld(true);
    assert.equal(world.root.getObjectByName('Torii').visible,false,'gate has passed out of view');
    const box = new THREE.Box3().setFromObject(world.root.getObjectByName('CherryBranches'));
    assert.ok(box.min.x >= -.5*aspect*height && box.max.x <= .5*aspect*height, `tree cropped at ${w}x${h}`);
    assert.ok(box.min.y >= -.4*height && box.max.y <= .5*height, `tree cropped vertically at ${w}x${h}`);
  }
  world.update(input, 0); assert.equal(world.root.visible, false);
  releaseRetired(world.root);
});

test('the fitted saya has an open mouth and stays in full-object camera views', async () => {
  const model = createKatanaModel();
  const katanaBytes = readFileSync(new URL('../public/models/ronin-katana-v04.glb', import.meta.url));
  installKatanaAsset(model, await parseKatanaAsset(buffer(katanaBytes)));
  const saya = await load('saya');
  saya.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-.2,0,0),new THREE.Vector3(1,0,0),0,1.2);
  for (const material of resources(saya.root).materials) material.side = THREE.DoubleSide;
  assert.equal(ray.intersectObject(saya.root, true).length, 0, 'generated cap still blocks the mouth');
  replaceChildren(model.saya, saya, model.root);
  for (const [w,h] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080],[844,390]]) {
    const frames = [0,.26,.74,.80,1].map(p => sampleMotion(p,w < 700));
    frames.push(...[0,4].map(topic => inspectionFrame(sampleMotion(.35),1,topic,w < 700)));
    for (const frame of frames) for (const rotation of frame.free ? [-1.35,0,1.35] : [0]) {
      applyComposition(model,frame,rotation);
      const fit = fitComposition(model,frame,w/h), half = fit.height / 2;
      const camera = new THREE.OrthographicCamera(-half*w/h,half*w/h,half,-half,.1,100);
      camera.position.set(fit.x,fit.y,24); camera.lookAt(fit.x,fit.y,0); camera.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(frame.progress === .26 ? model.sword : model.root);
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) {
        const p = new THREE.Vector3(x,y,0).project(camera), sx=.5+p.x/2, sy=.5-p.y/2;
        assert.ok(sx >= frame.safeLeft-.015 && sx <= frame.safeRight+.015, `horizontal crop ${w}, ${frame.progress}`);
        assert.ok(sy >= frame.safeTop-.015 && sy <= frame.safeBottom+.015, `vertical crop ${w}, ${frame.progress}`);
      }
    }
  }
  releaseRetired(model.root);
});

test('replacing a prop preserves pose and shared materials; failed requests retain its fallback', async t => {
  const material = new THREE.MeshStandardMaterial(), oldGeometry = new THREE.BoxGeometry();
  const root = new THREE.Group(), target = new THREE.Group(); root.add(target);
  target.position.set(3,2,1); target.add(new THREE.Mesh(oldGeometry, material));
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  let geometryDisposed = false, materialDisposed = false;
  oldGeometry.addEventListener('dispose', () => geometryDisposed=true);
  material.addEventListener('dispose', () => materialDisposed=true);
  replaceChildren(target, await load('torii'), root);
  assert.ok(geometryDisposed); assert.equal(materialDisposed,false); assert.deepEqual(target.position.toArray(),[3,2,1]);
  const children = target.children.slice();
  t.mock.method(globalThis,'fetch',async () => new Response('',{status:503}));
  await assert.rejects(loadSceneAsset(PROP_URLS.sakura,new AbortController().signal),/503/);
  assert.deepEqual(target.children,children);
  releaseRetired(root); assert.ok(materialDisposed);
});
