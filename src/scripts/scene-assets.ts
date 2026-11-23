import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fetchAssetBuffer, type DownloadProgress } from './asset-loading.ts';

export const PROP_URLS = {
  torii: '/models/ronin-torii-v01.glb',
  sakura: '/models/ronin-sakura-v01.glb',
  saya: '/models/ronin-saya-v03.glb',
} as const;

export function resources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    }
  });
  return { geometries, materials, textures };
}

/** Release only resources no other live part still shares (e.g. brass or cloth). */
export function releaseRetired(root: THREE.Object3D, retained?: THREE.Object3D) {
  const old = resources(root), keep = retained ? resources(retained) : undefined;
  old.geometries.forEach(item => { if (!keep?.geometries.has(item)) item.dispose(); });
  old.materials.forEach(item => { if (!keep?.materials.has(item)) item.dispose(); });
  old.textures.forEach(item => { if (!keep?.textures.has(item)) item.dispose(); });
}

export async function parseSceneAsset(buffer: ArrayBuffer) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
  const assets = resources(gltf.scene);
  return { root: gltf.scene, textures: [...assets.textures] };
}
export type SceneAsset = Awaited<ReturnType<typeof parseSceneAsset>>;

export async function loadSceneAsset(url: string, signal: AbortSignal, onProgress?: DownloadProgress) {
  return parseSceneAsset(await fetchAssetBuffer(url, signal, onProgress));
}

export function replaceChildren(target: THREE.Group, asset: SceneAsset, retained: THREE.Object3D) {
  const old = new THREE.Group(); old.add(...Array.from(target.children));
  target.add(asset.root); releaseRetired(old, retained);
}
