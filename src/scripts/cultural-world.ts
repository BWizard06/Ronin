import * as THREE from 'three';
import type { WorldInput } from './opening-world';
import { resources, replaceChildren, releaseRetired, type SceneAsset } from './scene-assets.ts';
import { culturePath } from './culture-motion.mjs';
import { blossomGust, cultureTurnWeight } from './culture-interaction.mjs';
import { createCulturalLandscape } from './cultural-landscape.ts';

export type CulturePose = { toriiTurn?:number; toriiTilt?:number; sakuraTurn?:number; sakuraTilt?:number };

/** Lightweight scenery remains available while the authored props load. */
export function createCulturalWorld() {
  const root = new THREE.Group(); root.name = 'ToriiAndSakura';
  const landscape=createCulturalLandscape();root.add(landscape.root);
  const gate = new THREE.Group(); gate.name = 'Torii'; root.add(gate);
  const gateModel = new THREE.Group(); gateModel.name = 'ToriiModel'; gateModel.position.y = -.03; gate.add(gateModel);
  const vermilion = new THREE.MeshStandardMaterial({ color: '#a82e22', roughness: .72, metalness: .06 });
  const charcoal = new THREE.MeshStandardMaterial({ color: '#222923', roughness: .85 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4c4035', roughness: 1 });
  const blossom = new THREE.MeshStandardMaterial({ color: '#f2d9d2', roughness: .8, side: THREE.DoubleSide });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0) {
    const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); gateModel.add(item); return item;
  }
  for (const sign of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(.022, .032, .49, 12), vermilion, sign * .19, -.025).rotation.z = sign * -.035;
    mesh(new THREE.CylinderGeometry(.035, .037, .065, 12), charcoal, sign * .199, -.235);
  }
  mesh(new THREE.BoxGeometry(.51, .033, .04), vermilion, 0, .102);
  mesh(new THREE.BoxGeometry(.026, .091, .03), vermilion, 0, .157);
  function lintel(width: number, height: number, bend: number, material: THREE.Material, y: number, depth: number) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, bend); shape.quadraticCurveTo(0, -bend, width / 2, bend);
    shape.lineTo(width / 2, bend - height); shape.quadraticCurveTo(0, -bend - height, -width / 2, bend - height); shape.closePath();
    return mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 }), material, 0, y, -depth / 2);
  }
  lintel(.66, .028, .025, charcoal, .25, .065);
  lintel(.60, .026, .02, vermilion, .221, .052);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#647163', transparent: true, opacity: .09, depthWrite: false }));
  ground.scale.set(.37, .034, 1); ground.position.set(.02, -.30, -.09); root.add(ground);
  gate.rotation.y = -.14;

  const tree = new THREE.Group(); tree.name = 'CherryBranches'; root.add(tree);
  const treeWood = new THREE.Group(); treeWood.name = 'SakuraWood'; tree.add(treeWood);
  const tips: THREE.Vector3[] = [];
  const branches = [
    [[.38,-.32,-.09],[.34,-.02,-.09],[.43,.24,-.13],[.36,.44,-.17]],
    [[.36,.06,-.10],[.21,.19,-.12],[.07,.27,-.12],[-.10,.29,-.12]],
    [[.40,.22,-.12],[.28,.32,-.12],[.18,.43,-.13],[.02,.47,-.11]],
    [[.42,.20,-.12],[.54,.28,-.10],[.61,.38,-.12],[.68,.44,-.11]],
    [[.20,.20,-.12],[.13,.30,-.10],[.00,.37,-.11],[-.15,.39,-.13]],
    [[.30,.32,-.13],[.35,.40,-.13],[.47,.45,-.11],[.54,.48,-.13]],
  ];
  branches.forEach((points, index) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, 22, index === 0 ? .012 : .005, 6, false);
    const branch = new THREE.Mesh(geometry, wood); treeWood.add(branch);
    for (let i = 5; i <= 12; i++) tips.push(curve.getPoint(i / 12));
  });
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0); petalShape.bezierCurveTo(-.007,.004,-.009,.014,-.003,.017); petalShape.lineTo(0,.014); petalShape.lineTo(.003,.017); petalShape.bezierCurveTo(.009,.014,.007,.004,0,0);
  const petalGeometry = new THREE.ShapeGeometry(petalShape, 4);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const random = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
  function makeBlossoms(anchors: THREE.Vector3[], attached = false) {
    const flowerCount = anchors.length * 4, petals = new THREE.InstancedMesh(petalGeometry, blossom, flowerCount * 5);
    petals.name = 'SakuraPetals'; petals.frustumCulled = false;
    for (let i = 0; i < flowerCount; i++) {
      const centre = anchors[Math.floor(i / 4)], spread = attached ? .018 : .08;
      const x = centre.x + (random(i + 1) - .5) * spread, y = centre.y + (random(i + 801) - .5) * spread;
      const z = centre.z + (random(i + 903) - .5) * spread;
      for (let j = 0; j < 5; j++) {
        dummy.position.set(x, y, z); dummy.rotation.set((random(i + 71) - .5) * 1.8, (random(i + 431) - .5) * 2.2, j * Math.PI * .4 + random(i + 31));
        dummy.scale.setScalar(attached ? .38 + random(i + 115) * .40 : .7 + random(i + 115) * .7); dummy.updateMatrix(); petals.setMatrixAt(i * 5 + j, dummy.matrix);
        tint.setHSL(.96 + random(i + 22) * .035, .20 + random(i + 81) * .14, .83 + random(i + 52) * .14); petals.setColorAt(i * 5 + j, tint);
      }
    }
    return petals;
  }
  let petals = makeBlossoms(tips); tree.add(petals);
  const drifting = new THREE.InstancedMesh(petalGeometry, blossom, 18); drifting.name = 'FallingPetals'; drifting.frustumCulled = false; root.add(drifting);
  // These petals start at real branch anchors, unlike a screen space overlay.
  let blossomPoints=tips;
  const gustPetals=new THREE.InstancedMesh(petalGeometry,blossom,48);
  gustPetals.name='WindPetals';gustPetals.frustumCulled=false;gustPetals.visible=false;root.add(gustPetals);
  let gustStarted=-Infinity;
  const treeCentre=new THREE.Vector3(.20,.07,-.15), pivotOffset=new THREE.Vector3();
  const pickBox=new THREE.Box3();
  const materials = new Map<THREE.Material, number>();
  const textures: THREE.Texture[] = [];
  function refreshMaterials() {
    const live = resources(root);
    for (const material of materials.keys()) if (!live.materials.has(material)) materials.delete(material);
    live.materials.forEach(material => { if (!materials.has(material)) materials.set(material, material.opacity); });
    textures.splice(0, textures.length, ...live.textures);
    restoreOpacity();
  }
  function restoreOpacity() {
    materials.forEach((opacity, material) => { material.opacity = opacity; });
  }
  refreshMaterials();
  return {
    root, textures,
    intersects(ray:THREE.Ray,target:string) {
      if(!root.visible)return false;
      const object=target==='torii'?gate:tree;
      if(!object.visible)return false;
      root.updateWorldMatrix(true,true);
      return ray.intersectsBox(pickBox.setFromObject(object));
    },
    breeze(time:number,reduced=false) {
      if(reduced)return false;
      // Repeated clicks cannot accumulate particles or keep restarting frame 0.
      if(time-gustStarted<1)return false;
      gustStarted=time;return true;
    },
    installTorii(asset: SceneAsset) {
      replaceChildren(gateModel, asset, root); gate.userData.asset = 'tripo'; refreshMaterials();
    },
    installSakura(asset: SceneAsset) {
      let anchors: number[] = [];
      asset.root.traverse(object => { if (Array.isArray(object.userData.blossomAnchors)) anchors = object.userData.blossomAnchors; });
      if (anchors.length < 30 || anchors.length % 3 || !anchors.every(Number.isFinite)) {
        releaseRetired(asset.root); throw new Error('The cherry tree is missing its blossom anchors.');
      }
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < anchors.length; i += 3) points.push(new THREE.Vector3(anchors[i], anchors[i + 1], anchors[i + 2]));
      blossomPoints=points;
      replaceChildren(treeWood, asset, root);
      tree.remove(petals); petals.dispose(); petals = makeBlossoms(points, true); tree.add(petals);
      tree.userData.asset = 'tripo'; refreshMaterials();
    },
    update(input: WorldInput, presence: number, progress = 0, pose:CulturePose={}) {
      root.visible = presence > .001;
      if (!root.visible) { gustStarted=-Infinity; return; }
      const { viewport, reduced } = input, mobile = input.compact ?? viewport.aspect < .85;
      const path=culturePath(progress,viewport.aspect,mobile,reduced,input.cultureArea);
      landscape.update(input,progress);
      root.scale.setScalar(viewport.height);
      root.position.set(viewport.x,viewport.y-(1-presence)*viewport.height*1.4,-1);
      gate.visible=path.gateVisible; gate.scale.setScalar(path.gateScale);gate.position.set(path.gateX,path.gateY,.15);
      const time = reduced ? 0 : input.time;
      const gateWeight=cultureTurnWeight(progress,'torii'),treeWeight=cultureTurnWeight(progress,'sakura');
      const gust=reduced?0:blossomGust(time-gustStarted);
      gate.rotation.set(path.gatePitch+(pose.toriiTilt??0)*gateWeight,path.gateYaw+(pose.toriiTurn??0)*gateWeight+(reduced?0:input.pointerX*.28*gateWeight),0);
      ground.visible=gate.visible;ground.scale.set(.37*path.gateScale,.034*path.gateScale,1);
      ground.position.set(path.gateX+.02*path.gateScale,path.gateY-.30*path.gateScale,-.09);
      tree.scale.setScalar(path.treeScale);
      tree.rotation.set(THREE.MathUtils.clamp(path.treePitch+(pose.sakuraTilt??0)*treeWeight+(reduced?0:input.pointerY*.10*treeWeight),-.12,.12),
        path.treeYaw+(pose.sakuraTurn??0)*treeWeight+(reduced?0:input.pointerX*.30*treeWeight+Math.sin(time*.17)*.035),
        reduced?0:Math.sin(time*.35)*.009+(gust>0?Math.sin((time-gustStarted)*5)*gust*.018:0));
      // Imported coordinates are offset from the origin. Rotate around the
      // canopy's centre, not around the corner of the authored bounding box.
      pivotOffset.copy(treeCentre).multiplyScalar(path.treeScale).applyEuler(tree.rotation);
      tree.position.set(path.treeX,path.treeY,-.6+treeCentre.z*path.treeScale).sub(pivotOffset);
      for(const particles of [drifting,gustPetals]){particles.position.copy(tree.position);particles.quaternion.copy(tree.quaternion);particles.scale.copy(tree.scale);}
      restoreOpacity();
      for (let i = 0; i < 18; i++) {
        const phase = (random(i + 80) + time * (.022 + random(i + 2) * .014) + (reduced?0:path.petalTravel*.38)) % 1;
        dummy.position.set(-.18 + random(i + 36) * .86 + Math.sin(time * .6 + i) * .035, .45 - phase * .78, -.12+random(i+330)*.36);
        dummy.rotation.set(time * .3 + i, i * .7, phase * 8 + i);
        dummy.scale.setScalar(.65*Math.min(1,phase/.08,(1-phase)/.12));dummy.updateMatrix(); drifting.setMatrixAt(i, dummy.matrix);
      }
      drifting.instanceMatrix.needsUpdate = true;
      const age=time-gustStarted;
      gustPetals.visible=!reduced&&age>=0&&age<4.8&&treeWeight>.5;
      if(gustPetals.visible) {
        for(let i=0;i<gustPetals.count;i++) {
          const elapsed=Math.max(0,age-random(i+420)*.42),phase=Math.min(1,elapsed/4.3);
          const anchor=blossomPoints[Math.floor(random(i+61)*blossomPoints.length)];
          dummy.position.copy(anchor);
          dummy.position.x+=elapsed*.10+Math.sin(elapsed*2+i)*elapsed*.024;
          dummy.position.y-=elapsed*.035+elapsed*elapsed*.025;
          dummy.position.z+=Math.sin(i+elapsed)*elapsed*.04;
          dummy.rotation.set(i+elapsed*1.9,i*.4+elapsed,i+elapsed*1.3);
          dummy.scale.setScalar((age<random(i+420)*.42?0:1)*(.5+random(i+72)*.35)*(1-smoothEnd(phase)));
          dummy.updateMatrix();gustPetals.setMatrixAt(i,dummy.matrix);
        }
        gustPetals.instanceMatrix.needsUpdate=true;
      }
    },
  };
}

function smoothEnd(phase:number) { const p=THREE.MathUtils.clamp((phase-.72)/.28,0,1);return p*p*(3-2*p); }
