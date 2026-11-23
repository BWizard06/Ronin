import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDetailWorld } from '../src/scripts/detail-world.ts';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';
import { detailState, hasDetailMotion } from '../src/scripts/detail-motion.mjs';
import { openingState } from '../src/scripts/opening-motion.mjs';

const world = createDetailWorld(), model = createKatanaModel();
const targets = { blade: new THREE.Vector3(), grip: new THREE.Vector3(), guard: new THREE.Vector3() };
function update(progress, aspect = 1.6, time = 0, reduced = false) {
  const frame = sampleMotion(progress, aspect < .85);
  applyComposition(model, frame);
  const fit = fitComposition(model, frame, aspect);
  model.blade.localToWorld(targets.blade.set(3.6, .2, 0));
  model.grip.localToWorld(targets.grip.set(-1.1, 0, 0));
  model.guard.localToWorld(targets.guard.set(0, 0, 0));
  world.update({ progress, time, reduced, pointerX: .3, pointerY: -.4, viewport: { ...fit, aspect }, swordMatrix: model.root.matrixWorld, targets });
  assert.deepEqual(fitComposition(model, frame, aspect), fit, 'scenery must not affect the katana camera');
}

test('each following passage has scenery and transitions have no empty background gap', () => {
  let previous = detailState(0);
  for (let i = 0; i <= 1000; i++) {
    const progress = i / 1000, state = detailState(progress);
    for (const key of Object.keys(state)) {
      assert.ok(state[key] >= 0 && state[key] <= 1);
      assert.ok(Math.abs(state[key] - previous[key]) < .04);
    }
    assert.ok(Math.max(openingState(progress).landscape, openingState(progress).paper, ...Object.values(state)) > .4, `empty world at ${progress}`);
    assert.equal(hasDetailMotion(progress, true), false);
    previous = state;
  }
  for (const [progress, name] of [[.26, 'archive'], [.42, 'steel'], [.58, 'weave'], [.74, 'assembly']]) {
    update(progress);
    assert.equal(world.root.getObjectByName(`${name}-world`).visible, true);
    assert.equal(detailState(progress)[name], 1);
  }
  for (const progress of [0, 1]) {
    update(progress);
    assert.equal(world.root.children.some(child => child.visible), false);
  }
});

test('detail scenery stays finite and inside its geometry budget across viewport sizes', () => {
  for (const aspect of [.4, .75, 1.6, 2.4]) for (const progress of [.2, .26, .34, .42, .50, .58, .66, .74, .85, .94]) {
    update(progress, aspect, 600);
    let triangles = 0;
    world.root.traverse(object => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return;
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), object.name);
      const position = object.geometry.getAttribute('position'), index = object.geometry.getIndex();
      if (index) assert.ok(index.array.every(i => i >= 0 && i < position.count));
      if (object instanceof THREE.Mesh) triangles += (index?.count ?? position.count) / 3;
    });
    assert.ok(triangles < 18000, `detail geometry budget: ${triangles}`);
  }
});

test('part markers track the projected parts during separation on portrait and desktop', () => {
  for (const aspect of [.46, 1.6]) for (const progress of [.64, .70, .74, .82, .9]) {
    update(progress, aspect, 5);
    for (const part of Object.keys(targets)) {
      const centre = world.root.getObjectByName(`${part}-orbit`).getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(centre.x - targets[part].x) < 1e-7);
      assert.ok(Math.abs(centre.y - targets[part].y) < 1e-7);
    }
  }
});

test('reduced motion freezes cloth, floating sheets, dust and pointer parallax', () => {
  function snapshot() {
    const result = [];
    world.root.traverse(object => {
      result.push(...object.matrixWorld.elements);
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        result.push(...object.geometry.getAttribute('position').array);
        if (object.material instanceof THREE.ShaderMaterial && object.material.uniforms.uTime) result.push(object.material.uniforms.uTime.value);
      }
    });
    return result;
  }
  for (const progress of [.26, .42, .58, .74]) {
    update(progress, 1.6, 0, true); const frozen = snapshot();
    update(progress, 1.6, 500, true); assert.deepEqual(snapshot(), frozen);
  }
  const cloth = world.root.getObjectByName('red-silk-ribbon');
  update(.58, 1.6, 0);
  const start = [...cloth.geometry.getAttribute('position').array];
  update(.58, 1.6, 2);
  assert.notDeepEqual([...cloth.geometry.getAttribute('position').array], start);
});
