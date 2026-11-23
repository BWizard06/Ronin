import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {portraitLayout,inspectionArea,culturalArea,renderPixelRatio} from '../src/scripts/viewport-layout.mjs';
import {createKatanaModel} from '../src/scripts/katana-model.ts';
import {parseKatanaAsset,installKatanaAsset,disposeModelResources} from '../src/scripts/katana-asset.ts';
import {parseSceneAsset,PROP_URLS,releaseRetired} from '../src/scripts/scene-assets.ts';
import {createCulturalWorld} from '../src/scripts/cultural-world.ts';
import {inspectionFrame} from '../src/scripts/inspection.mjs';
import {sampleMotion} from '../src/scripts/motion.mjs';
import {applyComposition,fitComposition} from '../src/scripts/composition.ts';
import {installImageBitmapStandIn} from './support/image-bitmap.mjs';
installImageBitmapStandIn();
const sizes=[[320,568],[375,667],[390,664],[390,844],[430,932],[768,1024]];
const bytes=url=>{const b=readFileSync(new URL('../public'+url,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};

test('the real sword follows the mobile preview slot as its text scrolls, without losing the complete form',async()=>{
  const model=createKatanaModel();installKatanaAsset(model,await parseKatanaAsset(bytes('/models/ronin-katana-v04.glb')));
  for(const [width,height]of sizes)for(const scroll of [0,120,300])for(const topic of [0,4]){
    const slot=inspectionArea(-scroll,Math.min(440,Math.max(285,height*.48))-scroll,height);
    const frame=inspectionFrame(sampleMotion(.35,true),1,topic,true,slot);
    applyComposition(model,frame);const fit=fitComposition(model,frame,width/height);
    const camera=new THREE.OrthographicCamera(-fit.height*width/height/2,fit.height*width/height/2,fit.height/2,-fit.height/2,.1,100);
    camera.position.set(fit.x,fit.y,24);camera.lookAt(fit.x,fit.y,0);camera.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model.root);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y]){
      const p=new THREE.Vector3(x,y,0).project(camera),sx=.5+p.x/2,sy=.5-p.y/2;
      assert.ok(sx>=slot.left-.015&&sx<=slot.right+.015);
      assert.ok(sy>=slot.top-.015&&sy<=slot.bottom+.015,`${width}x${height}: sword overlaps reading space`);
    }
  }
  disposeModelResources(model.root,model.textures);
});

test('real torii and sakura rotations stay above the measured controls and copy on portrait screens',async()=>{
  const world=createCulturalWorld();
  world.installTorii(await parseSceneAsset(bytes(PROP_URLS.torii)));
  world.installSakura(await parseSceneAsset(bytes(PROP_URLS.sakura)));
  for(const [width,height]of sizes){
    const {area,copyTop,controlsTop}=culturalArea(height,width<=375?270:240,44,24,20);
    assert.ok(controlsTop+44<copyTop);assert.ok(area.bottom*height<controlsTop);
    for(const [name,phase]of [['Torii',0],['Torii',.08],['Torii',.16],['CherryBranches',.82],['CherryBranches',.9],['CherryBranches',1]])for(const turn of [-Math.PI,-1,0,1,Math.PI])for(const tilt of [-.12,.12]){
      world.update({progress:.92,time:0,reduced:false,pointerX:0,pointerY:0,compact:true,viewport:{x:0,y:0,height:1,aspect:width/height},swordMatrix:new THREE.Matrix4(),cultureArea:area},1,phase,{toriiTurn:turn,sakuraTurn:turn,toriiTilt:tilt,sakuraTilt:tilt});
      world.root.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(world.root.getObjectByName(name));
      const top=.5-box.max.y,bottom=.5-box.min.y;
      assert.ok(top>=area.top-.025,`${name}, ${width}x${height}: top ${top} outside ${area.top}`);
      assert.ok(bottom<=area.bottom+.025,`${name}, ${width}x${height}: bottom ${bottom} outside ${area.bottom}`);
      assert.ok(box.min.x>=-width/height*.48&&box.max.x<=width/height*.48);
    }
  }
  releaseRetired(world.root);
});

test('portrait framing and GPU budgets remain appropriate after a phone rotates',()=>{
  assert.equal(portraitLayout(390,844),true);assert.equal(portraitLayout(844,390),false);
  assert.equal(portraitLayout(768,1024),true);assert.equal(portraitLayout(1440,900),false);
  for(const [width,height]of [[390,844],[844,390],[768,1024],[1024,1366]]){
    const ratio=renderPixelRatio(width,height,3,true);
    assert.ok(ratio<=1.5);assert.ok(width*height*ratio**2<=1800001);
  }
  assert.equal(renderPixelRatio(1440,900,2,false),Math.sqrt(3600000/(1440*900)));
});
