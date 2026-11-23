import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCulturalLandscape } from '../src/scripts/cultural-landscape.ts';
import { releaseRetired } from '../src/scripts/scene-assets.ts';

const input={progress:.92,time:0,reduced:false,pointerX:0,pointerY:0,viewport:{x:0,y:0,height:1,aspect:1.6},swordMatrix:new THREE.Matrix4()};
function snapshot(world){
  world.root.updateMatrixWorld(true);const result=[];
  world.root.traverse(object=>{result.push(object.matrixWorld.toArray());if(object instanceof THREE.InstancedMesh)result.push(Array.from(object.instanceMatrix.array));if(object.material instanceof THREE.ShaderMaterial)result.push(Object.fromEntries(Object.entries(object.material.uniforms).map(([key,{value}])=>[key,value.toArray?.()??value])));});
  return result;
}

test('the garden has a bounded mesh cost, shared grove batches and valid geometry in every scroll pose',()=>{
  const world=createCulturalLandscape();let triangles=0,meshes=0;
  world.root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;meshes++;
    const geometry=object.geometry;
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    triangles+=(geometry.index?.count??geometry.attributes.position.count)/3*(object instanceof THREE.InstancedMesh?object.count:1);
  });
  assert.ok(meshes<28,`environment adds ${meshes} draw calls`);
  assert.ok(triangles<14000,`environment adds ${triangles} triangles`);
  assert.equal(world.root.getObjectByName('GardenCedars').children.length,2);
  for(const [width,height]of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080]])for(let i=0;i<=40;i++) {
    world.update({...input,time:700,compact:width<700,viewport:{...input.viewport,aspect:width/height}},i/40);
    for(const values of snapshot(world))if(Array.isArray(values))assert.ok(values.every(Number.isFinite));
  }
  releaseRetired(world.root);
});

test('the garden retains depth through independently moving ridges and water',()=>{
  const world=createCulturalLandscape(),far=world.root.getObjectByName('GardenRidge0'),near=world.root.getObjectByName('GardenRidge3'),water=world.root.getObjectByName('GardenWater');
  for(const aspect of [.43,1.6]) {
    const frame={...input,compact:aspect<.6,viewport:{...input.viewport,aspect}};
    world.update(frame,.21);
    const start={near:near.position.x,far:far.position.x,water:water.material.uniforms.uTravel.value};
    world.update(frame,.74);
    assert.ok(Math.abs(near.position.x-start.near)>Math.abs(far.position.x-start.far)*2);
    assert.ok(water.material.uniforms.uTravel.value>start.water);
  }
  releaseRetired(world.root);
});

test('reduced motion freezes the entire environment while normal time animates its atmosphere',()=>{
  const world=createCulturalLandscape();
  world.update({...input,reduced:true,time:0,pointerX:-.5},.9);const first=snapshot(world);
  world.update({...input,reduced:true,time:2000,pointerX:.5},.9);assert.deepEqual(snapshot(world),first);
  world.update({...input,time:20},.9);assert.notDeepEqual(snapshot(world),first);
  const water=world.root.getObjectByName('GardenWater');assert.equal(water.material.uniforms.uTime.value,20);
  releaseRetired(world.root);
});
