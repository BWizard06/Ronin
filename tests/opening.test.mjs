import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOpeningWorld } from '../src/scripts/opening-world.ts';
import { openingState, hasAmbientMotion } from '../src/scripts/opening-motion.mjs';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';

const world = createOpeningWorld(), model = createKatanaModel();
function update(progress, aspect = 1.6, time = 4, reduced = false) {
  const frame = sampleMotion(progress, aspect < .85);
  applyComposition(model, frame);
  const viewport = { ...fitComposition(model, frame, aspect), aspect };
  world.update({ progress, viewport, time, reduced, pointerX: .5, pointerY: -.5, swordMatrix: model.root.matrixWorld });
  return viewport;
}

test('new scenery remains finite through scroll, portrait framing and long-running wind', () => {
  for (const aspect of [.4, .75, 1.6, 2.4]) for (const progress of [0, .06, .1, .135, .17, .2, .24, .26, .5, 1]) {
    update(progress, aspect, 600);
    let triangles = 0;
    world.root.traverse(object => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name);
      if (!(object instanceof THREE.Mesh)) return;
      for (const attribute of Object.values(object.geometry.attributes)) {
        assert.ok(attribute.array.every(Number.isFinite), `non-finite geometry in ${object.name}`);
      }
      const positions = object.geometry.getAttribute('position');
      const index = object.geometry.getIndex();
      if (index) assert.ok(index.array.every(i => i >= 0 && i < positions.count));
      triangles += (index?.count ?? positions.count) / 3;
    });
    assert.ok(triangles < 15000, `opening geometry budget exceeded: ${triangles}`);
  }
});

test('water covers the lower viewport without leaving a gap when the sword rises', () => {
  for (const aspect of [.4, 1.6, 2.4]) for (const progress of [0, .06, .125]) {
    const viewport = update(progress, aspect);
    const bounds = new THREE.Box3().setFromObject(world.root.getObjectByName('water'));
    assert.ok(bounds.min.x <= viewport.x - viewport.height * aspect / 2);
    assert.ok(bounds.max.x >= viewport.x + viewport.height * aspect / 2);
    assert.ok(bounds.min.y < viewport.y - viewport.height / 2);
    assert.ok(bounds.max.y > viewport.y - viewport.height * .1);
  }
});

test('cloth responds to time, while reduced motion holds one wind pose', () => {
  const cloth = world.root.getObjectByName('vermilion-cloth');
  update(.04, 1.6, 0);
  const start = [...cloth.geometry.getAttribute('position').array];
  update(.04, 1.6, 2);
  assert.notDeepEqual([...cloth.geometry.getAttribute('position').array], start);
  update(.04, 1.6, 500, true);
  assert.deepEqual([...cloth.geometry.getAttribute('position').array], start);
  assert.equal(world.ripple(.5, .8, 500, 0, true), false);
  assert.equal(world.ripple(.5, .2, 500, 0, false), false);
  assert.equal(world.ripple(.5, .8, 500, .42, false), false);
  assert.equal(world.ripple(.5, .8, 500, 0, false), true);
  assert.equal(world.ripple(.5, .8, 500.01, 0, false), false);
});

test('paper opens continuously, releases the detail scenes and returns to the landscape', () => {
  let previous = openingState(0);
  for (let i = 1; i <= 1000; i++) {
    const state = openingState(i / 1000);
    for (const key of Object.keys(state)) {
      assert.ok(state[key] >= 0 && state[key] <= 1);
      assert.ok(Math.abs(state[key] - previous[key]) < .045);
    }
    assert.ok(state.opening >= previous.opening);
    previous = state;
  }
  assert.equal(hasAmbientMotion(0, false), true);
  assert.equal(hasAmbientMotion(0, true), false);
  for (const progress of [.26, .42, .58, .74]) {
    update(progress);
    assert.equal(world.root.getObjectByName('ink-landscape').visible, false);
    assert.equal(world.root.getObjectByName('opening-paper').visible, false);
    assert.equal(hasAmbientMotion(progress, false), false);
  }
  update(1);
  assert.equal(world.root.getObjectByName('ink-landscape').visible, true);
  assert.equal(world.root.getObjectByName('opening-paper').visible, false);
  assert.equal(hasAmbientMotion(1, false), true);
  assert.equal(hasAmbientMotion(1, true), false);
});
