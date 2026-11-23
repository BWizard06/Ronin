import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parseKatanaAsset, installKatanaAsset, disposeModelResources, loadKatanaAsset, PART_NAMES } from '../src/scripts/katana-asset.ts';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';
import { inspectionFrame } from '../src/scripts/inspection.mjs';

const bytes = readFileSync(new URL('../public/models/ronin-katana-v04.glb', import.meta.url));
const buffer = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test('the compressed production asset decodes locally with only the four intended parts', async () => {
  assert.ok(bytes.length < 3_200_000, `download budget: ${bytes.length}`);
  const manifest = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(manifest.scenes.length, 1);
  assert.equal(manifest.images, undefined, 'no original Tripo textures or external texture requests');
  assert.equal(manifest.meshes.length, 14);
  assert.ok(!manifest.nodes.some(node => /tripo|cube|camera/i.test(node.name)));
  const asset = await parseKatanaAsset(buffer());
  assert.deepEqual(Object.keys(asset.parts).sort(), [...PART_NAMES].sort());
  let triangles = 0;
  asset.root.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return;
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = mesh.geometry.getAttribute(name);
      assert.ok(attribute, `${mesh.name}: missing ${name}`);
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `${mesh.name}: invalid ${name}`);
    }
    triangles += mesh.geometry.index.count / 3;
    const position = mesh.geometry.getAttribute('position');
    assert.ok(Array.from(mesh.geometry.index.array).every(index => index < position.count));
    if (mesh.userData.surface === 'steel') {
      assert.equal(mesh.material.metalness, 1);
      assert.ok(mesh.material.anisotropy > 0);
      assert.ok(mesh.material.roughnessMap && mesh.material.map);
      assert.ok(Array.from(mesh.geometry.getAttribute('tangent').array).every(Number.isFinite));
    }
  });
  assert.ok(triangles > 100_000 && triangles < 165_000, `geometry budget: ${triangles}`);
  disposeModelResources(asset.root, asset.textures);
});

test('a late model load preserves current part transforms and disposes the replaced resources', async () => {
  const model = createKatanaModel();
  applyComposition(model, sampleMotion(.74));
  const originalGroups = PART_NAMES.map(part => model[part]);
  const transforms = originalGroups.map(group => group.matrix.clone());
  let disposedGeometry = false, disposedTexture = false;
  model.blade.children[0].geometry.addEventListener('dispose', () => { disposedGeometry = true; });
  model.textures[0].addEventListener('dispose', () => { disposedTexture = true; });
  const asset = await parseKatanaAsset(buffer());
  installKatanaAsset(model, asset);
  assert.ok(disposedGeometry && disposedTexture);
  PART_NAMES.forEach((part, index) => {
    assert.equal(model[part], originalGroups[index]);
    assert.deepEqual(model[part].matrix.elements, transforms[index].elements);
    assert.ok(model[part].children.length);
  });
  assert.equal(model.root.userData.assetVersion, 'katana-v04');
  assert.equal(model.textures.length, 6);
  disposeModelResources(model.root, model.textures);
});

test('the real model stays inside full-object camera frames, including mobile and direct rotation', async () => {
  const model = createKatanaModel(); installKatanaAsset(model, await parseKatanaAsset(buffer()));
  for (const [width, height] of [[320,800],[390,844],[390,600],[768,1024],[1440,900],[2560,1080],[844,390]]) {
    const frames = [0,.26,.74,.80,1].map(p => sampleMotion(p, width < 700));
    frames.push(...[0,4].map(topic => inspectionFrame(sampleMotion(.35), 1, topic, width < 700)));
    for (const frame of frames) for (const rotation of frame.free ? [-1.35,0,1.35] : [0]) {
      applyComposition(model, frame, rotation);
      const fit = fitComposition(model, frame, width / height), half = fit.height / 2;
      const camera = new THREE.OrthographicCamera(-half * width / height, half * width / height, half, -half, .1, 100);
      camera.position.set(fit.x, fit.y, 24); camera.lookAt(fit.x, fit.y, 0); camera.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(frame.progress === .26 ? model.sword : model.root);
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
        const p = new THREE.Vector3(x,y,z).project(camera), sx = .5 + p.x / 2, sy = .5 - p.y / 2;
        const label = `${width}x${height}, p=${frame.progress}, turn=${rotation}`;
        assert.ok(sx >= frame.safeLeft-.015 && sx <= frame.safeRight+.015, `horizontal crop ${label}: ${sx}`);
        assert.ok(sy >= frame.safeTop-.015 && sy <= frame.safeBottom+.015, `vertical crop ${label}: ${sy}`);
      }
    }
  }
  disposeModelResources(model.root, model.textures);
});

test('failed and aborted model requests reject without touching the existing interactive model', async t => {
  const model = createKatanaModel(), children = model.blade.children.slice();
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(loadKatanaAsset(new AbortController().signal), /503/);
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { signal.throwIfAborted(); });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadKatanaAsset(controller.signal), { name: 'AbortError' });
  assert.deepEqual(model.blade.children, children);
  disposeModelResources(model.root, model.textures);
});
