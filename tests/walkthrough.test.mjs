import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createInspectionMotion} from '../src/scripts/inspection.mjs';
import {createKatanaModel} from '../src/scripts/katana-model.ts';
import {parseKatanaAsset,installKatanaAsset,KATANA_ASSET_URL} from '../src/scripts/katana-asset.ts';
import {applyComposition,departComposition,fitComposition} from '../src/scripts/composition.ts';
import {sampleMotion} from '../src/scripts/motion.mjs';
import {sampleJourney} from '../src/scripts/journey-flow.mjs';
import {culturePath} from '../src/scripts/culture-motion.mjs';
import {resources,releaseRetired} from '../src/scripts/scene-assets.ts';
const bytes=readFileSync(new URL('../public'+KATANA_ASSET_URL,import.meta.url));
const asset=()=>parseKatanaAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));

test('whole to scabbard moves directly without visiting grip and guard close-ups',()=>{
 const inspect=createInspectionMotion(),base=sampleMotion(.35);
 inspect(base,1,0,false,1/60,true);
 for(let i=0;i<120;i++) {
  const frame=inspect(base,1,4,false,1/60);
  assert.equal(frame.zoom,0);assert.equal(frame.detailHeight,5.5);
  assert.ok(Math.abs(frame.rotationY+.32)<1e-8);
 }
});

test('departures never make the material layers transparent and are reversible',async()=>{
 const model=createKatanaModel();installKatanaAsset(model,await asset());
 const original=[...resources(model.root).materials].map(m=>[m,m.opacity,m.transparent,m.depthWrite]);
 for(const p of [.61,.87]) for(const presence of [0,.2,.4,.6,.8,1,.8,.4,0]) {
  const frame=sampleMotion(p);model.root.position.set(0,0,0);applyComposition(model,frame);
  const fit=fitComposition(model,frame,1.6);departComposition(model,presence,fit.height,1.6);
  for(const [m,opacity,transparent,depth] of original){assert.equal(m.opacity,opacity);assert.equal(m.transparent,transparent);assert.equal(m.depthWrite,depth);}
  assert.equal(model.root.visible,presence<.95);
  if(presence===0)assert.equal(model.root.position.lengthSq(),0);
 }
 releaseRetired(model.root);
});

test('guard slides clear of the tang before it lifts or rotates',async()=>{
 const model=createKatanaModel();installKatanaAsset(model,await asset());
 for(let i=0;i<=100;i++) {
  const separation=i/100;applyComposition(model,{...sampleMotion(.74),rotationX:0,rotationY:0,rotationZ:0,separation});
  if(separation<=.8){assert.ok(Math.abs(model.guard.position.y)<1e-8);assert.ok(Math.abs(model.guard.rotation.y)<1e-8);}
  else {
   const guard=new THREE.Box3().setFromObject(model.guard),blade=new THREE.Box3().setFromObject(model.blade),grip=new THREE.Box3().setFromObject(model.grip);
   assert.ok(guard.max.x<blade.min.x-.05,'guard crosses the blade when lifted');
   assert.ok(grip.max.x<guard.min.x-.05,'guard collides with detached grip');
  }
 }
 releaseRetired(model.root);
});

test('refined point keeps blade width until the short kissaki and cloth has a woven surface',async()=>{
 const model=await asset();let steel,wrap;
 model.root.traverse(o=>{if(o.userData.surface==='steel')steel=o;if(o.userData.surface==='wrap')wrap=o;});
 const positions=steel.geometry.attributes.position,ys=[];
 for(let i=0;i<positions.count;i++)if(Math.abs(positions.getX(i)-6.30)<.025)ys.push(positions.getY(i));
 assert.ok(Math.max(...ys)-Math.min(...ys)>.20,'point still tapers into an elongated needle');
 assert.ok(wrap.material.map&&wrap.material.bumpMap);assert.ok(wrap.material.roughness>=.9);assert.ok(wrap.material.metalness===0);
 releaseRetired(model.root);
});

test('culture travel is continuous, separates the gate and tree moments, and respects reduced motion',()=>{
 for(const aspect of [.43,.75,1.6,2.4]) {
  const compact=aspect<.6;let previous=culturePath(0,aspect,compact);
  for(let i=1;i<=1000;i++) {
   const next=culturePath(i/1000,aspect,compact);
   for(const key of ['gateScale','gateX','gateY','treeScale','treeX','treeY']){assert.ok(Number.isFinite(next[key]));assert.ok(Math.abs(next[key]-previous[key])<.15,`${key} jumps`);}
   previous=next;
  }
  assert.equal(culturePath(.1,aspect,compact).gateVisible,true);assert.equal(culturePath(.8,aspect,compact).gateVisible,false);
  assert.deepEqual(culturePath(.8,aspect,compact,true),culturePath(.95,aspect,compact,true));
 }
 const span=[{start:1000,end:4500,from:.87,to:.87,mode:'culture'}];
 assert.equal(sampleJourney(span,3500,1000).contentProgress,1,'sakura must arrive before the sticky copy starts leaving');
});
