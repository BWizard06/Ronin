import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createObjectTypography } from '../src/scripts/object-typography.ts';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';
import { editorialState } from '../src/scripts/editorial-motion.mjs';

const type = createObjectTypography(), model = createKatanaModel();
const targets = { blade: new THREE.Vector3(), guard: new THREE.Vector3(), grip: new THREE.Vector3() };
function update(progress, aspect) {
  const frame = sampleMotion(progress, aspect < .85); applyComposition(model, frame);
  const fit = fitComposition(model, frame, aspect);
  model.blade.localToWorld(targets.blade.set(3.6, .2, 0));
  model.guard.localToWorld(targets.guard.set(0, 0, 0));
  model.grip.localToWorld(targets.grip.set(-1.1, 0, 0));
  const anchors = type.update({ progress, time: 2, reduced: false, pointerX: .4, pointerY: -.3, viewport: { ...fit, aspect }, swordMatrix: model.root.matrixWorld, targets });
  assert.deepEqual(fitComposition(model, frame, aspect), fit);
  return { fit, anchors };
}

test('editorial rhythm includes intentional object-only passages', () => {
  for (const progress of [.13, .325, .478, .65, .835, .89]) {
    assert.equal(editorialState(progress).active, null);
    assert.ok(Object.values(editorialState(progress).opacity).every(value => value === 0));
  }
  let previous = editorialState(0).opacity;
  for (let i = 0; i <= 2000; i++) {
    const current = editorialState(i / 2000).opacity;
    for (const key of Object.keys(current)) {
      assert.ok(current[key] >= 0 && current[key] <= 1);
      assert.ok(Math.abs(current[key] - previous[key]) < .065);
    }
    previous = current;
  }
});

test('font outlines produce valid geometry and exactly one glass treatment', () => {
  let triangles = 0, glass = 0;
  type.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), object.name);
    const positions = object.geometry.getAttribute('position');
    assert.ok(positions.count > 0);
    const index = object.geometry.getIndex();
    if (index) assert.ok(index.array.every(i => i >= 0 && i < positions.count));
    triangles += (index?.count ?? positions.count) / 3;
    if (object.material instanceof THREE.MeshPhysicalMaterial && object.material.transmission > 0) { glass++; assert.equal(object.material.depthWrite,true,'transparent scenery must not draw over the glass lettering'); }
  });
  assert.equal(glass, 1);
  assert.ok(triangles < 15000, `type budget exceeded: ${triangles}`);
});

test('object-aligned words remain inside portrait and wide frames without reframing the katana', () => {
  for (const aspect of [.38, .46, .75, 1.33, 1.6, 2.37]) for (const progress of [.22, .24, .265, .545, .57, .595, .72, .75, .775]) {
    const { fit, anchors } = update(progress, aspect);
    for (const anchor of Object.values(anchors)) assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
    for (const group of type.root.children.filter(child => child.visible)) {
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(bounds.min.x >= fit.x - fit.height * aspect * .465, `${group.name}: left overflow, aspect=${aspect}`);
      assert.ok(bounds.max.x <= fit.x + fit.height * aspect * .465, `${group.name}: right overflow, aspect=${aspect}`);
      assert.ok(bounds.min.y >= fit.y - fit.height * .435);
      assert.ok(bounds.max.y <= fit.y + fit.height * .435);
    }
  }
});
