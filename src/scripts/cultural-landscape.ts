import * as THREE from 'three';
import type { WorldInput } from './opening-world';
import { mix, smooth } from './motion.mjs';
import { culturePath } from './culture-motion.mjs';

const random=(seed:number)=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};
const vertex=/* glsl */`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise=/* glsl */`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}`;

/** Environment coordinates share the cultural scene's viewport-height space.
 * Depth layers move at different rates; nothing depends on pointer activity. */
export function createCulturalLandscape() {
  const root=new THREE.Group();root.name='CulturalLandscape';
  const cool=new THREE.Color('#cbd7cc'),warm=new THREE.Color('#edddd0');
  const horizon=new THREE.Group();horizon.name='GardenHorizon';root.add(horizon);
  const ridges:THREE.Mesh<THREE.ShapeGeometry,THREE.MeshBasicMaterial>[]=[];
  for(let layer=0;layer<4;layer++) {
    const shape=new THREE.Shape();shape.moveTo(-1.4,-.55);
    for(let i=0;i<=84;i++) {
      const x=-1.4+i/30;
      const y=.06+Math.exp(-Math.pow((x+.75-layer*.08)/.35,2))*.24
        +Math.exp(-Math.pow((x-.85+layer*.06)/.31,2))*.32
        +Math.sin(x*16+layer*5)*.016+Math.sin(x*39+layer)*.008;
      shape.lineTo(x,y);
    }
    shape.lineTo(1.4,-.55);shape.closePath();
    const ridge=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#9ba99a'}));
    ridge.name=`GardenRidge${layer}`;ridge.position.z=-2.8+layer*.35;horizon.add(ridge);ridges.push(ridge);
  }
  const sun=new THREE.Mesh(new THREE.CircleGeometry(.105,48),new THREE.MeshBasicMaterial({color:'#ca947d'}));
  sun.name='GardenSun';sun.position.z=-3.1;root.add(sun);

  const waterUniforms={uTime:{value:0},uTravel:{value:0},uWarm:{value:0},uLightX:{value:.7}};
  const waterMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:/* glsl */`
    varying vec2 vUv;uniform float uTime;uniform float uTravel;uniform float uWarm;uniform float uLightX;
    ${noise}
    void main(){
      float depth=1.-vUv.y;
      float wave=sin(vUv.y*210.+sin(vUv.x*27.+uTime*.27)*2.1+uTime*.65+uTravel*18.);
      float ripple=pow(max(0.,wave),16.)*(.3+noise(vUv*vec2(28.,65.))*.7);
      vec3 nearColour=mix(vec3(.14,.23,.20),vec3(.34,.35,.28),uWarm);
      vec3 farColour=mix(vec3(.43,.52,.43),vec3(.63,.57,.45),uWarm);
      vec3 colour=mix(farColour,nearColour,smoothstep(0.,.95,depth));
      float reflection=exp(-pow((vUv.x-uLightX+sin(vUv.y*40.)*.014)*9.,2.));
      colour+=ripple*(.025+reflection*.15)+noise(vUv*vec2(16.,6.)+uTime*.01)*.025;
      float alpha=smoothstep(0.,.11,1.-vUv.y)*(1.-smoothstep(.52,.98,depth));
      gl_FragColor=vec4(colour,alpha*.80);
      #include <colorspace_fragment>
    }`,uniforms:waterUniforms,transparent:true,depthWrite:false});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1,1),waterMaterial);water.name='GardenWater';water.renderOrder=1;root.add(water);
  const mistUniforms={uTime:{value:0},uColour:{value:cool.clone()}};
  const mist=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:/* glsl */`
    varying vec2 vUv;uniform float uTime;uniform vec3 uColour;${noise}
    void main(){float cloud=noise(vec2(vUv.x*5.-uTime*.018,vUv.y*3.));
    float veil=exp(-pow((vUv.y-.5+(cloud-.5)*.2)*4.,2.));
    gl_FragColor=vec4(uColour,veil*.55);
    #include <colorspace_fragment>
    }`,uniforms:mistUniforms,transparent:true,depthWrite:false}));
  mist.name='GardenMist';mist.renderOrder=2;root.add(mist);

  const forest=new THREE.Group();forest.name='GardenCedars';root.add(forest);
  const bark=new THREE.MeshBasicMaterial({color:'#8e9f8e'});
  const foliage=new THREE.MeshBasicMaterial({color:'#98aa96'});
  const trunkGeometry=new THREE.CylinderGeometry(.008,.012,.55,5);
  const crownGeometry=new THREE.IcosahedronGeometry(1,0);
  // The grove uses two draw calls rather than one per branch tier.
  const trunks=new THREE.InstancedMesh(trunkGeometry,bark,15);trunks.name='CedarTrunks';trunks.frustumCulled=false;
  const crowns=new THREE.InstancedMesh(crownGeometry,foliage,135);crowns.name='CedarCrowns';crowns.frustumCulled=false;forest.add(trunks,crowns);
  const cedarFrame=new THREE.Object3D(),tierFrame=new THREE.Object3D(),cedarMatrix=new THREE.Matrix4();
  const stoneMaterial=new THREE.MeshStandardMaterial({color:'#737c6e',roughness:.95,flatShading:true});
  const mossMaterial=new THREE.MeshStandardMaterial({color:'#6a7752',roughness:1,flatShading:true});
  const rockGeometry=new THREE.IcosahedronGeometry(1,1);
  const stones=new THREE.InstancedMesh(rockGeometry,stoneMaterial,18);stones.name='GardenSteppingStones';stones.frustumCulled=false;root.add(stones);
  const bankGeometry=new THREE.SphereGeometry(1,24,10);
  const bankPositions=bankGeometry.getAttribute('position');
  for(let i=0;i<bankPositions.count;i++){
    const x=bankPositions.getX(i),y=bankPositions.getY(i),z=bankPositions.getZ(i);
    const edge=1+Math.sin(x*9+z*4)*.08+Math.sin(z*13-x*3)*.04;
    bankPositions.setXYZ(i,x*edge,y*(1+Math.sin(x*7+z*5)*.10),z*edge);
  }
  bankGeometry.computeVertexNormals();
  const bankMaterial=new THREE.MeshStandardMaterial({color:'#808473',roughness:1});
  const footing=new THREE.Mesh(bankGeometry,bankMaterial);footing.name='ToriiFooting';root.add(footing);
  const island=new THREE.Group();island.name='SakuraIsland';root.add(island);
  const base=new THREE.Mesh(bankGeometry,bankMaterial);base.scale.set(.33,.038,.17);island.add(base);
  const moss=new THREE.Mesh(bankGeometry,mossMaterial);moss.position.set(-.01,.02,0);moss.scale.set(.31,.025,.15);island.add(moss);
  const grassGeometry=new THREE.BufferGeometry();
  grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.007,0,0,.007,0,0,.005,.037,.006,.014,.069,.01],3));
  grassGeometry.setIndex([0,1,2,0,2,3]);grassGeometry.computeVertexNormals();
  const grassMaterial=new THREE.MeshStandardMaterial({color:'#748760',roughness:1,side:THREE.DoubleSide});
  const grass=new THREE.InstancedMesh(grassGeometry,grassMaterial,100);grass.name='IslandGrass';island.add(grass);
  const dummy=new THREE.Object3D();
  for(let i=0;i<100;i++) {
    const angle=random(i+42)*Math.PI*2,radius=Math.sqrt(random(i+149));
    dummy.position.set(Math.cos(angle)*radius*.29,.034,Math.sin(angle)*radius*.12);
    dummy.rotation.set(0,random(i+316)*Math.PI*2,(random(i+71)-.5)*.2);dummy.scale.setScalar(.45+random(i+19)*.6);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  }

  const edgeBough=new THREE.Group();edgeBough.name='GardenCanopyEdge';root.add(edgeBough);
  const woodMaterial=new THREE.MeshStandardMaterial({color:'#605245',roughness:1});
  const branches=[
    [[-.38,-.15,0],[-.13,-.01,.03],[.14,.10,0],[.4,.31,-.03]],
    [[-.16,-.02,.02],[-.14,.11,.03],[-.25,.21,.05]],
    [[.06,.07,0],[.22,.04,-.02],[.36,.09,.02]],
    [[.20,.16,-.02],[.34,.21,0],[.48,.20,.02]],
  ];
  const flowerPoints:THREE.Vector3[]=[];
  branches.forEach((points,i)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    edgeBough.add(new THREE.Mesh(new THREE.TubeGeometry(curve,18,i===0?.012:.0045,5,false),woodMaterial));
    for(let j=3;j<=10;j++)flowerPoints.push(curve.getPoint(j/10));
  });
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.014,.008,-.018,.028,-.006,.034);shape.lineTo(0,.027);shape.lineTo(.006,.034);shape.bezierCurveTo(.018,.028,.014,.008,0,0);
  const petalMaterial=new THREE.MeshStandardMaterial({color:'#eccac1',roughness:.85,side:THREE.DoubleSide});
  const flowers=new THREE.InstancedMesh(new THREE.ShapeGeometry(shape,3),petalMaterial,flowerPoints.length*5);flowers.name='ForegroundBlossoms';edgeBough.add(flowers);
  for(let i=0;i<flowerPoints.length;i++)for(let j=0;j<5;j++) {
    dummy.position.copy(flowerPoints[i]);dummy.rotation.set((random(i+7)-.5)*.7,(random(i+88)-.5)*.9,j*Math.PI*.4+i);
    dummy.scale.setScalar(.55+random(i+75)*.35);dummy.updateMatrix();flowers.setMatrixAt(i*5+j,dummy.matrix);
  }
  const ridgeColour=new THREE.Color(),tint=new THREE.Color(),ridgeInk=new THREE.Color('#506957');
  const warmSun=new THREE.Color('#ddb394'),warmFoliage=new THREE.Color('#b1b09a');

  return {root,
    update(input:WorldInput,progress:number) {
      const {viewport,reduced}=input,compact=input.compact??viewport.aspect<.85;
      const path=culturePath(progress,viewport.aspect,compact,reduced,input.cultureArea);
      let p=THREE.MathUtils.clamp(progress,0,1);if(reduced)p=p<.38?0:p<.68?.53:.85;
      const bloom=smooth(.42,.92,p),travel=smooth(.05,.83,p),time=reduced?0:input.time;
      const aspect=viewport.aspect,h=compact?.31:.095;
      const pointer=reduced?0:input.pointerX;
      tint.copy(cool).lerp(warm,bloom);
      ridges.forEach((ridge,i)=>{
        ridge.scale.set(aspect*(1+i*.03),.72+i*.08,1);
        ridge.position.set(-travel*aspect*(.025+i*.02)+pointer*.015*(i+1),h-.10-i*.038,-2.8+i*.35);
        ridgeColour.copy(tint).lerp(ridgeInk,.13+i*.12);ridge.material.color.copy(ridgeColour);
      });
      sun.position.set(aspect*mix(.32,.25,travel),compact?.37:.26,-3.1);
      sun.material.color.set('#c38d75').lerp(warmSun,bloom);
      water.scale.set(aspect*1.5,h+.72,1);water.position.set(0,(h-.72)/2,-.95);
      waterUniforms.uTime.value=time;waterUniforms.uTravel.value=travel;waterUniforms.uWarm.value=bloom;waterUniforms.uLightX.value=.5+sun.position.x/(aspect*1.5);
      mist.scale.set(aspect*1.5,.3,1);mist.position.set(Math.sin(time*.06)*.025,h-.04,-1.35);
      mistUniforms.uTime.value=time;mistUniforms.uColour.value.copy(tint);
      for(let i=0;i<15;i++) {
        const side=i%2?1:-1,spread=.22+random(i+15)*.52;
        cedarFrame.position.set(side*aspect*spread-travel*aspect*(.06+random(i+41)*.08),h-.055-random(i+94)*.06,-1.8+random(i+25)*.2);
        cedarFrame.scale.setScalar(.18+random(i+71)*.28);cedarFrame.rotation.y=i*1.2+pointer*.12;cedarFrame.updateMatrix();
        tierFrame.position.set(0,.2,0);tierFrame.scale.setScalar(1);tierFrame.rotation.set(0,0,0);tierFrame.updateMatrix();
        trunks.setMatrixAt(i,cedarMatrix.multiplyMatrices(cedarFrame.matrix,tierFrame.matrix));
        for(let n=0;n<9;n++) {
          const s=1-n*.075,side=n%2?1:-1;
          tierFrame.position.set(side*.055*s,.08+n*.052,(random(i*9+n)-.5)*.06);
          tierFrame.scale.set((.08+random(n+15)*.04)*s,.045+random(n+31)*.018,.08*s);tierFrame.rotation.set(.15,n*1.3,(random(n+9)-.5)*.3);tierFrame.updateMatrix();
          crowns.setMatrixAt(i*9+n,cedarMatrix.multiplyMatrices(cedarFrame.matrix,tierFrame.matrix));
        }
      }
      trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;
      foliage.color.set('#98aa96').lerp(warmFoliage,bloom*.65);
      footing.visible=path.gateVisible;footing.position.set(path.gateX,path.gateY-.29*path.gateScale,-.03);
      footing.scale.set(.38*path.gateScale,.035*path.gateScale,.14*path.gateScale);footing.rotation.set(.35,.12,0);
      island.position.set(path.treeX,path.treeY-.37*path.treeScale,-.68);island.scale.setScalar(path.treeScale);island.rotation.x=.3;
      grass.rotation.z=Math.sin(time*.8)*.025;
      for(let i=0;i<18;i++) {
        const depth=((i/18-travel*.55)%1+1)%1,near=depth*depth;
        const entranceX=mix(path.gateX,path.treeX+.29*path.treeScale,bloom);
        const x=mix(entranceX,aspect*.10,near)+Math.sin(depth*4+p)*.065+(i%2?1:-1)*.025;
        const edge=Math.min(1,depth/.08,(1-depth)/.06),scale=(.025+near*.10)*edge*(compact?.7:1);
        dummy.position.set(x,mix(h-.015,-.70,near),mix(-1.65,-.45,near));
        dummy.scale.set(scale,(.014+near*.022)*edge,scale*.6);dummy.rotation.set(.4,i*1.43,0);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
      }
      stones.instanceMatrix.needsUpdate=true;
      edgeBough.visible=p>.52;
      const emerge=smooth(.52,.85,p);
      edgeBough.position.set(aspect*(.74-emerge*.15),.53-emerge*.07,.9);edgeBough.scale.setScalar((compact?.55:.82)*emerge);
      edgeBough.rotation.set(.1,.25,-2.6+Math.sin(time*.3)*.018);
    }
  };
}
