import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { createKatanaModel } from './katana-model';
import { fetchAssetBuffer, type DownloadProgress } from './asset-loading.ts';

export const KATANA_ASSET_URL = '/models/ronin-katana-v04.glb';
export const PART_NAMES = ['blade', 'guard', 'grip', 'saya'] as const;
type Part = typeof PART_NAMES[number];
type Model = ReturnType<typeof createKatanaModel>;

function dataTexture(width: number, height: number, pixel: (u: number, v: number) => number[], color = false) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const values = pixel(x / (width - 1), y / (height - 1));
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) bytes[offset + c] = Math.round(THREE.MathUtils.clamp(values[c], 0, 1) * 255);
    bytes[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

/** Same UV-based hamon and polish as the approved Blender light study. */
function surfaces() {
  const hamon = (u: number, v: number) => THREE.MathUtils.clamp((.235 + .022 * Math.sin(u * 72) + .009 * Math.sin(u * 163) - v) * 34 + .5, 0, 1);
  const color = new THREE.Color();
  const steelColor = dataTexture(1024, 128, (u, v) => {
    const h = hamon(u, 1 - v); // glTF's V axis is reversed from the authored Blender UV.
    color.setRGB(.48 + h * .07, .515 + h * .05, .55 + h * .03).convertLinearToSRGB();
    return [color.r, color.g, color.b];
  }, true);
  const steelRoughness = dataTexture(1024, 128, (u, v) => {
    const authoredV = 1 - v;
    const edge = THREE.MathUtils.clamp((authoredV - .008) / .037, 0, 1);
    const roughness = .075 + edge * .07 + hamon(u, authoredV) * .055;
    return [1, roughness, 1];
  });
  const grain = dataTexture(128, 128, (u, v) => {
    const n = .5 + .12 * Math.sin(v * 1970) + .035 * Math.sin(u * 83 + v * 463);
    return [n, n, n];
  });
  const fibre = (u: number,v: number) => {
    const warp=Math.sin(u*Math.PI*96),weft=Math.sin(v*Math.PI*72),over=(Math.floor(u*48)+Math.floor(v*36))%2;
    const grain=Math.sin(u*4813+v*1973)*Math.sin(v*3457-u*211);
    return .5+.22*(over?warp:weft)+.075*grain;
  };
  const textile = dataTexture(512, 256, (u, v) => {
    const n = fibre(u,v);
    return [n, n, n];
  });
  textile.wrapS = textile.wrapT = THREE.RepeatWrapping;
  textile.repeat.set(1, 1);
  const textileColour = dataTexture(512,256,(u,v)=>{
    const n=fibre(u,v),c=.115+n*.10;
    return [c*.95,c,c*.92];
  },true);
  textileColour.wrapS=textileColour.wrapT=THREE.RepeatWrapping;
  const skin = dataTexture(128, 128, (u, v) => {
    const row = Math.floor(v * 16), x = ((u * 16 + (row % 2) * .5) % 1) - .5, y = (v * 16) % 1 - .5;
    const n = .2 + .65 * Math.max(0, 1 - (x * x + y * y) * 5);
    return [n, n, n];
  });
  skin.wrapS = skin.wrapT = THREE.RepeatWrapping; skin.repeat.set(7, 2);
  const materials: Record<string, THREE.Material> = {
    steel: new THREE.MeshPhysicalMaterial({ color: 'white', map: steelColor, metalness: 1, roughness: 1, roughnessMap: steelRoughness, anisotropy: .28, bumpMap: grain, bumpScale: .00005 }),
    iron: new THREE.MeshStandardMaterial({ color: new THREE.Color(.023, .026, .028), metalness: .88, roughness: .32 }),
    brass: new THREE.MeshStandardMaterial({ color: new THREE.Color(.40, .255, .105), metalness: .9, roughness: .28 }),
    engraving: new THREE.MeshStandardMaterial({ color: new THREE.Color(.009, .012, .014), metalness: .7, roughness: .4 }),
    wrap: new THREE.MeshPhysicalMaterial({ color:'white',map:textileColour,roughness:.94,bumpMap:textile,bumpScale:.006,specularIntensity:.12,sheen:.35,sheenColor:'#55594e',sheenRoughness:.95 }),
    underlay: new THREE.MeshStandardMaterial({ color: new THREE.Color(.115, .006, .009), roughness: .76, bumpMap: skin, bumpScale: .003 }),
    cord: new THREE.MeshStandardMaterial({ color: new THREE.Color(.18, .009, .013), roughness: .72, bumpMap: textile, bumpScale: .0015 }),
    lacquer: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(.007, .008, .010), metalness: .08, roughness: .19, clearcoat: .85, clearcoatRoughness: .12 }),
    'red-lacquer': new THREE.MeshPhysicalMaterial({ color: new THREE.Color(.28, .016, .012), metalness: .15, roughness: .29, clearcoat: .4 }),
  };
  Object.entries(materials).forEach(([name, material]) => { material.name = `Ronin | ${name}`; });
  return { materials, textures: [steelColor, steelRoughness, grain, textile, textileColour, skin] };
}

export function disposeModelResources(root: THREE.Object3D, textures: THREE.Texture[] = []) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    geometries.add(item.geometry);
    (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

export async function parseKatanaAsset(buffer: ArrayBuffer) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  const parts = {} as Record<Part, THREE.Object3D>;
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse(object => {
    const part = object.userData.roninPart as Part;
    if (PART_NAMES.includes(part)) parts[part] = object;
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  if (PART_NAMES.some(part => !parts[part] || !parts[part].children.length)) {
    disposeModelResources(gltf.scene);
    throw new Error('The katana asset is missing a movable part.');
  }
  const { materials, textures } = surfaces();
  const importedMaterials = new Set<THREE.Material>();
  for (const mesh of meshes) {
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => importedMaterials.add(material));
    mesh.material = materials[mesh.userData.surface] ?? materials.iron;
    if (mesh.userData.surface === 'steel' && !mesh.geometry.hasAttribute('tangent')) mesh.geometry.computeTangents();
  }
  importedMaterials.forEach(material => material.dispose());
  return { root: gltf.scene, parts, textures };
}

export async function loadKatanaAsset(signal: AbortSignal, onProgress?: DownloadProgress) {
  return parseKatanaAsset(await fetchAssetBuffer(KATANA_ASSET_URL, signal, onProgress));
}

/** Keep the existing animation groups and their current transforms during a late load. */
export function installKatanaAsset(model: Model, asset: Awaited<ReturnType<typeof parseKatanaAsset>>) {
  disposeModelResources(model.root, model.textures);
  for (const part of PART_NAMES) {
    model[part].clear();
    model[part].add(...Array.from(asset.parts[part].children));
  }
  model.textures.length = 0; model.textures.push(...asset.textures);
  model.root.userData.assetVersion = 'katana-v04';
}
