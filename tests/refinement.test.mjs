import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {toggleTopic,inspectionControls} from '../src/scripts/interaction-state.mjs';
import {sampleMotion} from '../src/scripts/motion.mjs';
import {sampleJourney} from '../src/scripts/journey-flow.mjs';
import {bridgeFrame,applyComposition,fitComposition} from '../src/scripts/composition.ts';
import {createKatanaModel} from '../src/scripts/katana-model.ts';
import {createObjectTypography} from '../src/scripts/object-typography.ts';
import {parseSceneAsset,PROP_URLS,releaseRetired} from '../src/scripts/scene-assets.ts';
import {installImageBitmapStandIn} from './support/image-bitmap.mjs';
installImageBitmapStandIn();

test('every detail can be opened, switched and closed by clicking the same part',()=>{
 let topic=0;
 for(const next of [2,3,1,4]){topic=toggleTopic(topic,next);assert.equal(topic,next);topic=toggleTopic(topic,next);assert.equal(topic,0);}
 assert.equal(toggleTopic(toggleTopic(0,2),3),3);
 assert.equal(inspectionControls(1,true).enabled,true);
 for(const p of [.69,.74,.79,.82]){
  const exploded=sampleMotion(p);assert.ok(exploded.separation>0);
  assert.deepEqual(inspectionControls(0,true),{opacity:0,enabled:false},'exploded scene must not expose navigation controls');
 }
 assert.equal(inspectionControls(1,false).enabled,false);
});

test('material reading holds its own pose and the cultural bridge assembles the complete sword',()=>{
 const spans=[{start:0,end:1500,from:.35,to:.455,mode:''},{start:1500,end:3500,from:.455,to:.455,mode:'materials'},{start:3500,end:5000,from:.455,to:.62,mode:''}];
 for(const y of [1600,2400,3200]){const s=sampleJourney(spans,y,800);assert.equal(s.mode,'materials');assert.equal(s.progress,.455);}
 const model=createKatanaModel();
 for(const [w,h] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080]]){
  const frame=bridgeFrame(sampleMotion(.92,w<700),1,w<700);assert.equal(frame.separation,0);applyComposition(model,frame);
  const fit=fitComposition(model,frame,w/h),half=fit.height/2,camera=new THREE.OrthographicCamera(-half*w/h,half*w/h,half,-half,.1,100);
  camera.position.set(fit.x,fit.y,24);camera.lookAt(fit.x,fit.y,0);camera.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model.root);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y]){
   const p=new THREE.Vector3(x,y,0).project(camera);
   assert.ok(.5+p.x/2>frame.safeLeft-.01 && .5+p.x/2<frame.safeRight+.01);
   assert.ok(.5-p.y/2>frame.safeTop-.01 && .5-p.y/2<frame.safeBottom+.01);
  }
 }
 releaseRetired(model.root);
});

test('glass lettering returns to a light transparent material behind the blade',()=>{
 const type=createObjectTypography(),model=createKatanaModel();
 for(const aspect of [.43,.75,1.6,2.4])for(const progress of [.385,.407,.428]){
  const frame=sampleMotion(progress,aspect<.7);applyComposition(model,frame);const fit=fitComposition(model,frame,aspect);
  const targets={blade:new THREE.Vector3(),grip:new THREE.Vector3(),guard:new THREE.Vector3()};
  model.blade.localToWorld(targets.blade.set(3.6,.2,0));model.grip.localToWorld(targets.grip.set(-1.1,0,0));model.guard.localToWorld(targets.guard.set(0,0,0));
  type.update({progress,time:0,reduced:true,pointerX:0,pointerY:0,viewport:{...fit,aspect},swordMatrix:model.root.matrixWorld,targets});
  const glass=type.root.getObjectByName('STEEL glass');assert.ok(glass.material.transmission>.9);assert.ok(glass.material.metalness<.1);
  assert.ok(new THREE.Box3().setFromObject(glass).max.z<new THREE.Box3().setFromObject(model.blade).min.z,'glass intersects the blade depth');
 }
 releaseRetired(type.root);releaseRetired(model.root);
});

test('saya ornament shares a smooth nonmetallic lacquer surface without raised red fragments',async()=>{
 const bytes=readFileSync(new URL('../public'+PROP_URLS.saya,import.meta.url));
 const a=await parseSceneAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const meshes=[];a.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 const shell=meshes.find(m=>m.material.name.includes('continuous satin'));
 assert.ok(shell.material.map);assert.equal(shell.material.metalness,0);assert.ok(shell.material.roughness>=.35);
 assert.equal(shell.material.normalMap,null);assert.equal(meshes.some(m=>m.material.name.includes('red relief')),false);
 a.root.updateMatrixWorld(true);let previous;
 for(let x=2;x<=6.4;x+=.1){
  const center=.1683*Math.max(0,Math.min(1,(x-.187)/6.685))**2;
  const hits=new THREE.Raycaster(new THREE.Vector3(x,center,1),new THREE.Vector3(0,0,-1)).intersectObject(shell);
  assert.ok(hits.length);const n=hits[0].normal;
  if(previous)assert.ok(n.dot(previous)>.99,'wavy surface breaks the lacquer reflection');previous=n;
 }
 releaseRetired(a.root);
});
