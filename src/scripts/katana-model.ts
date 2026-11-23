import * as THREE from 'three';

export const bladeCurve = (x: number) => 0.008 * x * x;

function addMesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, name: string) {
  const item = new THREE.Mesh(geometry, material);
  item.name = name;
  parent.add(item);
  return item;
}

function surfaceTexture(kind: 'weave' | 'steel' | 'pebble') {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
    let value = 128;
    if (kind === 'weave') value += 42 * Math.sin(x * Math.PI / 4 + Math.sin(y * Math.PI / 8)) * Math.cos(y * Math.PI / 4) + noise * 15;
    if (kind === 'steel') value += 25 * Math.sin(y * 4.0) + 10 * Math.sin(y * 0.7) + noise * 13;
    if (kind === 'pebble') {
      const dx = (x + (Math.floor(y / 16) % 2) * 8) % 16 - 8;
      const dy = y % 16 - 8;
      value = 80 + 100 * Math.max(0, 1 - (dx * dx + dy * dy) / 58) + noise * 12;
    }
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.repeat.set(kind === 'weave' ? 16 : kind === 'steel' ? 2 : 10, kind === 'steel' ? 5 : 2);
  return texture;
}

function collarShape(y: number, z: number, hollow = false) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, z, y, 0, Math.PI * 2, false, 0);
  if (hollow) {
    const hole = new THREE.Path();
    hole.absellipse(0, 0, z * 0.78, y * 0.78, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
  }
  return shape;
}

function extrusion(shape: THREE.Shape, depth: number, bevel = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 3, curveSegments: 32,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

function ribbon(direction: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const steps = 320;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -2.36 + t * 2.18;
    const angle = t * 5.1 * Math.PI * 2 * direction;
    const weave = 0.0035 * Math.sin(angle * 2) * direction;
    for (const side of [-1, 1]) {
      positions.push(x + side * 0.055, Math.cos(angle) * (0.195 + weave), Math.sin(angle) * (0.139 + weave));
      uvs.push(t * 2, (side + 1) / 2);
    }
    if (i < steps) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sayaGeometry() {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const sections = 100, sides = 32;
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const x = 0.20 + t * 6.71;
    const taper = t < 0.93 ? 1 - 0.15 * t : Math.max(0.04, (1 - t) / 0.07 * 0.86);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      positions.push(x, bladeCurve(x) + Math.cos(angle) * 0.215 * taper, Math.sin(angle) * 0.125 * taper);
      uvs.push(t, j / sides);
      if (i < sections && j < sides) {
        const n = i * (sides + 1) + j;
        indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createKatanaModel() {
  const root = new THREE.Group(); root.name = 'Ronin';
  const sword = new THREE.Group(); sword.name = 'Katana'; root.add(sword);
  const blade = new THREE.Group(); blade.name = 'Blade'; sword.add(blade);
  const guard = new THREE.Group(); guard.name = 'Tsuba'; sword.add(guard);
  const grip = new THREE.Group(); grip.name = 'Tsuka'; sword.add(grip);
  const saya = new THREE.Group(); saya.name = 'Saya'; root.add(saya);

  const weave = surfaceTexture('weave');
  const brushed = surfaceTexture('steel');
  const pebble = surfaceTexture('pebble');
  const steel = new THREE.MeshPhysicalMaterial({ color: '#bac3cf', metalness: 1, roughness: 0.26, anisotropy: 0.35, bumpMap: brushed, bumpScale: 0.0007 });
  const edge = new THREE.MeshPhysicalMaterial({ color: '#d6dde5', metalness: 0.94, roughness: 0.38 });
  const gunmetal = new THREE.MeshPhysicalMaterial({ color: '#30302e', metalness: 0.88, roughness: 0.34, bumpMap: brushed, bumpScale: 0.001 });
  const vermilion = new THREE.MeshPhysicalMaterial({ color: '#df3023', metalness: 0.3, roughness: 0.21, clearcoat: 1 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#170d0c', metalness: 0.3, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.09 });
  const wrap = new THREE.MeshStandardMaterial({ color: '#1c1b19', roughness: 0.88, bumpMap: weave, bumpScale: 0.008, side: THREE.DoubleSide });
  const underlay = new THREE.MeshStandardMaterial({ color: '#d8d4c9', roughness: 0.84, bumpMap: pebble, bumpScale: 0.009 });

  const shape = new THREE.Shape();
  shape.moveTo(0.12, -0.16);
  for (let i = 0; i <= 96; i++) { const x = 0.12 + i / 96 * 6.18; shape.lineTo(x, bladeCurve(x) - 0.16 + x * 0.005); }
  shape.lineTo(6.86, bladeCurve(6.86) + 0.105);
  for (let i = 96; i >= 0; i--) { const x = 0.12 + i / 96 * 6.18; shape.lineTo(x, bladeCurve(x) + 0.115); }
  shape.closePath();
  const bladeBody = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.019, bevelSize: 0.008, bevelSegments: 2, steps: 1 });
  bladeBody.translate(0, 0, -0.0225);
  addMesh(bladeBody, steel, blade, 'Satin steel');
  // Concealed when assembled; the tang gives the separated grip a visible connection.
  const tangShape = new THREE.Shape();
  tangShape.moveTo(-1.82, -.065); tangShape.lineTo(.15, -.115);
  tangShape.lineTo(.15, .105); tangShape.lineTo(-1.82, .065); tangShape.closePath();
  const tangGeometry = new THREE.ExtrudeGeometry(tangShape, { depth: .045, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1, steps: 1 });
  tangGeometry.translate(0, 0, -.0225);
  addMesh(tangGeometry, gunmetal, blade, 'Tang');

  const hamonShape = new THREE.Shape();
  for (let i = 0; i <= 150; i++) {
    const x = 0.24 + i / 150 * 6.05;
    const y = bladeCurve(x) - 0.148 + x * 0.005;
    if (i === 0) hamonShape.moveTo(x, y); else hamonShape.lineTo(x, y);
  }
  for (let i = 150; i >= 0; i--) { const x = 0.24 + i / 150 * 6.05; hamonShape.lineTo(x, bladeCurve(x) - 0.085 + Math.sin(x * 12) * 0.007 + Math.sin(x * 23) * 0.004); }
  hamonShape.closePath();
  const hamonGeometry = new THREE.ShapeGeometry(hamonShape);
  for (const side of [-1, 1]) {
    const material = edge.clone(); material.side = side > 0 ? THREE.FrontSide : THREE.BackSide;
    const hamon = addMesh(hamonGeometry, material, blade, 'Hamon'); hamon.position.z = side * 0.042;
  }
  const collar = addMesh(extrusion(collarShape(0.18, 0.081), 0.22), steel, blade, 'Habaki'); collar.position.x = 0.17;

  const guardShape = new THREE.Shape();
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 12 + i * Math.PI / 6;
    const x = Math.cos(a) * 0.43, y = Math.sin(a) * 0.57;
    if (i === 0) guardShape.moveTo(x, y); else guardShape.lineTo(x, y);
  }
  guardShape.closePath();
  const hole = new THREE.Path(); hole.absellipse(0, 0, 0.08, 0.15, 0, Math.PI * 2, true, 0); guardShape.holes.push(hole);
  addMesh(extrusion(guardShape, 0.085, 0.014), gunmetal, guard, 'Faceted guard');
  const rimPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 12 + i * Math.PI / 6;
    rimPoints.push(new THREE.Vector3(0.007, Math.sin(a) * 0.575, Math.cos(a) * 0.435));
  }
  const rimCurve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < rimPoints.length - 1; i++) rimCurve.add(new THREE.LineCurve3(rimPoints[i], rimPoints[i + 1]));
  addMesh(new THREE.TubeGeometry(rimCurve, 120, 0.009, 5, true), vermilion, guard, 'Vermilion inlay');
  const innerRim = rimPoints.map(p => new THREE.Vector3(0.059, p.y * 0.92, p.z * 0.92));
  const engraved = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < innerRim.length - 1; i++) engraved.add(new THREE.LineCurve3(innerRim[i], innerRim[i + 1]));
  addMesh(new THREE.TubeGeometry(engraved, 96, 0.0025, 4, true), steel, guard, 'Fine face bevel');

  const core = addMesh(new THREE.CylinderGeometry(0.18, 0.18, 2.22, 48), underlay, grip, 'Textured underlay');
  core.rotation.z = Math.PI / 2; core.scale.z = 0.72; core.position.x = -1.27;
  for (const direction of [-1, 1]) addMesh(ribbon(direction), wrap, grip, 'Crossed cotton ribbon');
  for (const x of [-0.11, -2.40]) { const cap = addMesh(extrusion(collarShape(0.196, 0.142), 0.12), gunmetal, grip, 'Handle fitting'); cap.position.x = x; }

  addMesh(sayaGeometry(), lacquer, saya, 'Lacquered scabbard');
  for (const [x, length, material] of [[0.21, 0.09, gunmetal], [0.32, 0.045, vermilion]] as const) {
    const ring = addMesh(extrusion(collarShape(0.22, 0.132, true), length, 0.003), material, saya, 'Saya mouth');
    ring.position.set(x, bladeCurve(x), 0);
  }
  for (let i = 0; i < 11; i++) {
    const x = 1.02 + i * 0.029;
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 64; j++) { const a = j / 64 * Math.PI * 2; points.push(new THREE.Vector3(x, bladeCurve(x) + Math.cos(a) * 0.222, Math.sin(a) * 0.135)); }
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, 0.014, 5, true), wrap, saya, 'Sageo wrap');
  }
  const cordPoints = [[1.22, 0, 0.16], [1.45, -0.17, 0.18], [2, -0.23, 0.17], [2.10, -0.05, 0.16], [1.55, -0.03, 0.16], [1.35, -0.13, 0.19], [1.7, -0.36, 0.18], [2.3, -0.35, 0.15]].map(p => new THREE.Vector3(p[0], p[1], p[2]));
  addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPoints), 80, 0.023, 8, false), wrap, saya, 'Tied cord');

  return { root, sword, blade, guard, grip, saya, textures: [weave, brushed, pebble] as THREE.Texture[] };
}
