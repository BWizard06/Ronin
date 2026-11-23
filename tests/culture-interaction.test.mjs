import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { cultureTarget,gestureIntent,turnCulture } from '../src/scripts/culture-interaction.mjs';
import { culturePath } from '../src/scripts/culture-motion.mjs';
import { createCulturalWorld } from '../src/scripts/cultural-world.ts';
import { parseSceneAsset,PROP_URLS,releaseRetired } from '../src/scripts/scene-assets.ts';
import { installImageBitmapStandIn } from './support/image-bitmap.mjs';
installImageBitmapStandIn();

const input={progress:.92,time:0,reduced:false,pointerX:0,pointerY:0,compact:false,
  viewport:{x:0,y:0,height:8,aspect:1.6},swordMatrix:new THREE.Matrix4()};
async function installModels(world) {
  for(const name of ['torii','sakura']) {
    const bytes=readFileSync(new URL(`../public${PROP_URLS[name]}`,import.meta.url));
    const asset=await parseSceneAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    if(name==='torii')world.installTorii(asset);else world.installSakura(asset);
  }
}

test('gestures leave vertical touch scrolling and the gate passage under scroll control',()=>{
  assert.equal(gestureIntent(2,3,true),'pending');
  assert.equal(gestureIntent(8,25,true),'scroll');
  assert.equal(gestureIntent(-24,7,true),'rotate');
  assert.equal(gestureIntent(0,14,false),'rotate');
  assert.equal(cultureTarget(.5,0),'');
  assert.equal(cultureTarget(1,.1),'torii');
  for(const phase of [.17,.3,.5,.7,.81])assert.equal(cultureTarget(1,phase),'');
  assert.equal(cultureTarget(1,.9),'sakura');
  assert.equal(cultureTarget(.8,.9),'');
  for(const width of [320,1440]) {
    assert.equal(turnCulture(0,width*.5,width),Math.PI);
    assert.equal(turnCulture(Math.PI,1000,width),Math.PI);
    assert.equal(turnCulture(-Math.PI,-1000,width),-Math.PI);
  }
});

test('real models turn through front, sides and back without orbiting or leaving the viewport',async()=>{
  const world=createCulturalWorld();await installModels(world);
  const tree=world.root.getObjectByName('CherryBranches'),gate=world.root.getObjectByName('Torii');
  const centre=new THREE.Vector3(.2,.07,-.15),position=new THREE.Vector3();
  for(const [w,h] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080],[844,390]]) {
    const frame={...input,compact:w<700,viewport:{...input.viewport,aspect:w/h}};
    world.update(frame,1,.9);world.root.updateMatrixWorld(true);
    const reference=tree.localToWorld(centre.clone());
    for(let step=-8;step<=8;step++)for(const tilt of [-.12,0,.12]) {
      const yaw=step/8*Math.PI;
      world.update(frame,1,.9,{sakuraTurn:yaw,sakuraTilt:tilt});world.root.updateMatrixWorld(true);
      assert.ok(tree.localToWorld(position.copy(centre)).distanceTo(reference)<1e-6,'tree rotates about its centre');
      const box=new THREE.Box3().setFromObject(tree);
      assert.ok(box.min.x>=-4*w/h && box.max.x<=4*w/h,`tree horizontal crop ${w}x${h}, ${yaw}`);
      assert.ok(box.min.y>=-3.6 && box.max.y<=4,`tree vertical crop ${w}x${h}, ${yaw}, ${tilt}`);
      world.update(frame,1,.08,{toriiTurn:yaw,toriiTilt:tilt});world.root.updateMatrixWorld(true);
      const gateBox=new THREE.Box3().setFromObject(gate);
      assert.ok(gateBox.min.x>=-4*w/h && gateBox.max.x<=4*w/h,`gate crop ${w}x${h}`);
      assert.ok(gateBox.min.y>=-4 && gateBox.max.y<=4,`gate vertical crop ${w}x${h}`);
    }
  }
  releaseRetired(world.root);
});

test('cultural picking targets the object and manual turns unwind before the camera enters the gate',async()=>{
  const world=createCulturalWorld();await installModels(world);
  world.update(input,1,.08,{toriiTurn:.8});world.root.updateMatrixWorld(true);
  const gate=world.root.getObjectByName('Torii'),box=new THREE.Box3().setFromObject(gate);
  const centre=box.getCenter(new THREE.Vector3());centre.z=24;
  assert.equal(world.intersects(new THREE.Ray(centre,new THREE.Vector3(0,0,-1)),'torii'),true);
  assert.equal(world.intersects(new THREE.Ray(new THREE.Vector3(100,0,24),new THREE.Vector3(0,0,-1)),'torii'),false);
  const baseline=gate.rotation.y;
  world.update(input,1,.4,{toriiTurn:.8});assert.notEqual(gate.rotation.y,baseline);
  assert.equal(gate.rotation.y,culturePath(.4,input.viewport.aspect).gateYaw);
  world.update(input,0);assert.equal(world.intersects(new THREE.Ray(centre,new THREE.Vector3(0,0,-1)),'torii'),false);
  releaseRetired(world.root);
});

test('a breeze releases a bounded burst from the branches, expires, and respects reduced motion',async()=>{
  const world=createCulturalWorld();await installModels(world);
  world.update(input,1,.9);
  const wind=world.root.getObjectByName('WindPetals'),tree=world.root.getObjectByName('CherryBranches');
  assert.equal(wind.visible,false);
  assert.equal(world.breeze(2),true);assert.equal(world.breeze(2.2),false);
  world.update({...input,time:2.5},1,.9,{sakuraTurn:.7});
  assert.equal(wind.visible,true);assert.equal(wind.count,48);
  assert.deepEqual(wind.quaternion.toArray(),tree.quaternion.toArray());
  assert.ok(Array.from(wind.instanceMatrix.array).every(Number.isFinite));
  const sample=wind.instanceMatrix.array.slice();
  world.update({...input,time:3.5},1,.9,{sakuraTurn:.7});assert.notDeepEqual(wind.instanceMatrix.array,sample);
  world.update({...input,time:7},1,.9);assert.equal(wind.visible,false);
  assert.equal(world.breeze(8,true),false);
  world.update({...input,reduced:true,time:8},1,.9,{sakuraTurn:1});
  assert.equal(wind.visible,false);assert.equal(tree.rotation.y,culturePath(.9,input.viewport.aspect,false,true).treeYaw+1,'intentional exploration remains available');
  releaseRetired(world.root);
});

test('scroll alone reveals the sides of both props and retraces their poses without pointer input',async()=>{
  const world=createCulturalWorld();await installModels(world);
  const gate=world.root.getObjectByName('Torii'),tree=world.root.getObjectByName('CherryBranches');
  const sample=phase=>{
    world.update(input,1,phase);world.root.updateMatrixWorld(true);
    return {gate:gate.matrixWorld.toArray(),tree:tree.matrixWorld.toArray(),gateYaw:gate.rotation.y,treeYaw:tree.rotation.y};
  };
  const phases=[0,.08,.16,.22,.35,.5,.65,.78,.9,1];
  const forward=phases.map(sample);
  for(let i=phases.length-1;i>=0;i--)assert.deepEqual(sample(phases[i]),forward[i]);
  assert.ok(forward[3].gateYaw-forward[0].gateYaw>1,'gate exposes a distinctly different face before entry');
  assert.ok(forward.at(-1).treeYaw-forward[5].treeYaw>1.7,'tree changes by more than a token tilt');
  assert.equal(sample(.5).gateYaw,0,'gate faces the viewer during the actual passage');
  for(const key of ['gateYaw','gatePitch','treeYaw','treePitch','treeX','treeY']) {
    let previous=culturePath(0,1.6)[key];
    for(let i=1;i<=1000;i++) {
      const next=culturePath(i/1000,1.6)[key];
      assert.ok(Number.isFinite(next)&&Math.abs(next-previous)<.02,`${key} jumps`);previous=next;
    }
  }
  // The main reveal is viewed with no drag input. Check all its intermediate
  // angles as well as the final turntable pose, including narrow phones.
  for(const [w,h] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080]]) {
    const frame={...input,compact:w<700,viewport:{...input.viewport,aspect:w/h}};
    for(let i=0;i<=100;i++) {
      const phase=i/100;world.update(frame,1,phase);world.root.updateMatrixWorld(true);
      const object=phase<=.16?gate:phase>=.82?tree:null;
      if(!object)continue;
      const box=new THREE.Box3().setFromObject(object);
      assert.ok(box.min.x>=-4*w/h&&box.max.x<=4*w/h,`scroll framing crops at ${w}, ${phase}`);
      assert.ok(box.min.y>=-4&&box.max.y<=4,`vertical scroll framing crops at ${w}, ${phase}`);
    }
  }
  releaseRetired(world.root);
});
