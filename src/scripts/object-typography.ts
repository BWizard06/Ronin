import * as THREE from 'three';
import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import antonData from '../assets/typefaces/anton.json' with { type: 'json' };
import serifData from '../assets/typefaces/serif-italic.json' with { type: 'json' };
import { editorialState } from './editorial-motion.mjs';
import { clamp, mix, smooth } from './motion.mjs';
import type { WorldInput } from './opening-world';

export type ProjectedAnchors = Record<'centre' | 'guard' | 'grip' | 'tip', { x: number; y: number }> & {parts?:Record<'blade'|'grip'|'guard'|'saya',{x:number;y:number}>};
type TypeInput = WorldInput & { targets: Record<'blade' | 'guard' | 'grip', THREE.Vector3> };

function lettering(text: string, font: Font, glass = false, curve = 0) {
  const geometry = glass
    ? new TextGeometry(text, { font, size: 1, depth: .13, curveSegments: 5, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 3 })
    : new THREE.ShapeGeometry(font.generateShapes(text, 1), 5);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  geometry.scale(1 / size.x, 1 / size.x, 1 / size.x);
  if (curve) {
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      positions.setY(i, positions.getY(i) + Math.sin((x + .5) * Math.PI) * curve);
    }
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createObjectTypography() {
  const root = new THREE.Group(); root.name = 'object-typography';
  const anton = new FontLoader().parse(antonData), serif = new FontLoader().parse(serifData);
  const groups = { craft: new THREE.Group(), glass: new THREE.Group(), hand: new THREE.Group(), assembly: new THREE.Group() };
  for (const [name, group] of Object.entries(groups)) { group.name = `type-${name}`; root.add(group); }
  function word(text: string, font: Font, colour: string, parent: THREE.Group, curve = 0) {
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(lettering(text, font, false, curve), material);
    mesh.name = text; parent.add(mesh); return mesh;
  }
  const japanese = word('JAPANESE', anton, '#292a25', groups.craft);
  const craftsmanship = word('craftsmanship', serif, '#b62a1e', groups.craft, .065);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#fbf8eb', metalness: .06, roughness: .065, transmission: .92, thickness: .45, ior: 1.46,
    clearcoat: 1, clearcoatRoughness: .035, envMapIntensity: 1.8, transparent: true, depthWrite: true,
  });
  const glass = new THREE.Mesh(lettering('STEEL', anton, true), glassMaterial);
  glass.name = 'STEEL glass'; groups.glass.add(glass);
  const byHand = word('by hand', serif, '#eee7d5', groups.hand, .11);
  const words = [
    { mesh: word('EVERY', anton, '#251b15', groups.assembly), part: 'grip' as const, side: 1 },
    { mesh: word('detail', serif, '#f0e9d9', groups.assembly), part: 'guard' as const, side: -1 },
    { mesh: word('MATTERS.', anton, '#251b15', groups.assembly), part: 'blade' as const, side: 1 },
  ];
  const grip = new THREE.Vector3(), tip = new THREE.Vector3(), middle = new THREE.Vector3(), guard = new THREE.Vector3();
  const typeBounds = new THREE.Box3(), typeSize = new THREE.Vector3();
  function keepInFrame(mesh: THREE.Mesh, aspect: number) {
    mesh.updateMatrix(); typeBounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrix); typeBounds.getSize(typeSize);
    const scale = Math.min(1, aspect * .92 / typeSize.x, .85 / typeSize.y);
    if (scale < 1) mesh.scale.multiplyScalar(scale);
    mesh.updateMatrix(); typeBounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrix);
    if (typeBounds.min.x < -aspect * .46) mesh.position.x += -aspect * .46 - typeBounds.min.x;
    if (typeBounds.max.x > aspect * .46) mesh.position.x -= typeBounds.max.x - aspect * .46;
    if (typeBounds.min.y < -.43) mesh.position.y += -.43 - typeBounds.min.y;
    if (typeBounds.max.y > .43) mesh.position.y -= typeBounds.max.y - .43;
  }
  const anchors: ProjectedAnchors = { centre: { x: .5, y: .5 }, guard: { x: .5, y: .5 }, grip: { x: .5, y: .5 }, tip: { x: .5, y: .5 } };

  function update(input: TypeInput) {
    const { viewport, progress } = input, h = viewport.height, a = viewport.aspect;
    const state = editorialState(progress), portrait = a < .85;
    for (const name of Object.keys(state.opacity)) state.opacity[name] *= input.presence ?? 1;
    const px = input.reduced ? 0 : input.pointerX, py = input.reduced ? 0 : input.pointerY;
    root.position.set(viewport.x, viewport.y, 0); root.scale.setScalar(h);
    grip.set(-2.35, 0, 0).applyMatrix4(input.swordMatrix);
    tip.set(6.8, .37, 0).applyMatrix4(input.swordMatrix);
    guard.copy(input.targets.guard); middle.copy(grip).lerp(tip, .5);
    for (const [name, vector] of [['centre', middle], ['guard', guard], ['grip', grip], ['tip', tip]] as const) {
      anchors[name].x = .5 + (vector.x - viewport.x) / (h * a);
      anchors[name].y = .5 - (vector.y - viewport.y) / h;
    }
    const angle = Math.atan2(tip.y - grip.y, tip.x - grip.x);
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const cx = (middle.x - viewport.x) / h, cy = (middle.y - viewport.y) / h;
    const bladeLength = Math.hypot(tip.x - grip.x, tip.y - grip.y) / h;
    for (const name of Object.keys(groups) as (keyof typeof groups)[]) groups[name].visible = state.opacity[name] > .001;

    if (groups.craft.visible) {
      const enter = smooth(.17, .235, progress);
      const width = Math.min(portrait ? .88 : a * .92, bladeLength * .98);
      japanese.scale.setScalar(width);
      japanese.rotation.z = angle;
      japanese.position.set(cx + nx * .135 + (1 - enter) * .25, cy + ny * .135, -1.6 / h);
      japanese.material.opacity = state.opacity.craft;
      craftsmanship.scale.setScalar(width * .83);
      craftsmanship.rotation.z = angle - .025;
      craftsmanship.position.set(cx - nx * .16 - (1 - enter) * .25, cy - ny * .16, -.7 / h);
      craftsmanship.material.opacity = state.opacity.craft;
      keepInFrame(japanese, a); keepInFrame(craftsmanship, a);
    }
    if (groups.glass.visible) {
      const entry = smooth(.36, .42, progress);
      const width = a * (portrait ? 1.08 : 1.02);
      glass.scale.setScalar(width);
      glass.position.set(mix(-a * .13, a * .04, entry), .015 + py * .018, -3 / h);
      glass.rotation.set(py * .08, mix(-.23, .13, entry) + px * .12, -.04 + px * .025);
      glassMaterial.opacity = state.opacity.glass;
    }
    if (groups.hand.visible) {
      const centreX = (input.targets.grip.x - viewport.x) / h, centreY = (input.targets.grip.y - viewport.y) / h;
      const sweep = mix(-.65, .2, smooth(.515, .62, progress));
      byHand.scale.setScalar(portrait ? a * .94 : a * .65);
      byHand.rotation.z = angle + sweep;
      byHand.position.set(centreX + nx * .11, centreY + ny * .11, -.8 / h);
      byHand.material.opacity = state.opacity.hand;
      keepInFrame(byHand, a);
    }
    if (groups.assembly.visible) {
      for (const [index, item] of words.entries()) {
        const target = input.targets[item.part];
        const arrival = smooth(.685 + index * .006, .73 + index * .006, progress);
        const width = a * (portrait ? .34 : index === 1 ? .20 : .24);
        const x = (target.x - viewport.x) / h + nx * .13 * item.side;
        const y = (target.y - viewport.y) / h + ny * .13 * item.side;
        item.mesh.position.set(clamp(x, -a * .46 + width / 2, a * .46 - width / 2), clamp(y + (1 - arrival) * .12, -.38, .38), -.6 / h);
        item.mesh.rotation.z = angle * .24 + (index === 1 ? -.1 : .04);
        item.mesh.scale.setScalar(width); item.mesh.material.opacity = state.opacity.assembly * arrival;
        keepInFrame(item.mesh, a);
      }
    }
    root.updateMatrixWorld(true);
    return anchors;
  }
  return { root, update };
}
