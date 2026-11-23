import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleJourney, journeyOffset, timelineIndex } from '../src/scripts/journey-flow.mjs';
import { inspectionFrame } from '../src/scripts/inspection.mjs';
import { sampleMotion } from '../src/scripts/motion.mjs';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { createCulturalWorld } from '../src/scripts/cultural-world.ts';

const spans = [
  { start: 0, end: 2000, from: 0, to: .35, mode: '' },
  { start: 2000, end: 3400, from: .35, to: .35, mode: 'inspection' },
  { start: 3400, end: 5100, from: .35, to: .62, mode: '' },
  { start: 5100, end: 6500, from: .62, to: .62, mode: 'history' },
  { start: 6500, end: 8000, from: .62, to: .87, mode: '' },
  { start: 8000, end: 9400, from: .87, to: .87, mode: 'culture' },
  { start: 9400, end: 10500, from: .87, to: 1, mode: '' },
];

test('reading holds the object while leaving every animation reachable, including scroll restoration', () => {
  for (const span of spans.filter(item => item.mode)) {
    for (const y of [span.start, (span.start + span.end) / 2, span.end - 1]) {
      const sample = sampleJourney(spans, y, 800);
      assert.equal(sample.progress, span.from);
      assert.equal(sample.mode, span.mode);
      assert.ok(sample.presence > .5);
    }
  }
  for (let i = 0; i <= 100; i++) assert.ok(Math.abs(sampleJourney(spans, journeyOffset(spans, i / 100), 800).progress - i / 100) < 1e-9);
  assert.equal(sampleJourney(spans, -500, 800).progress, 0);
  assert.equal(sampleJourney(spans, 15000, 800).progress, 1);
  assert.equal(sampleJourney(spans, 15000, 800).presence, 0);
});

test('content entrances and exits stay continuous when scrolling in either direction', () => {
  let previous = sampleJourney(spans, 0, 800);
  for (let y = 1; y < 11000; y++) {
    const next = sampleJourney(spans, y, 800);
    assert.ok(Math.abs(next.progress - previous.progress) < .001);
    assert.ok(Math.abs(next.presence - previous.presence) < .004);
    assert.deepEqual(next, sampleJourney(spans, y, 800));
    previous = next;
  }
  assert.deepEqual([0,250,500,750,1000].map(value => timelineIndex(value)), [0,1,2,3,4]);
  assert.equal(timelineIndex(-1), 0); assert.equal(timelineIndex(2000), 4);
});

test('inspection fits the complete sword and sheath in the reserved display area', () => {
  const model = createKatanaModel();
  for (const [width, height] of [[320,740],[390,844],[768,1024],[1440,900],[2560,1080],[844,390]]) {
    for (const topic of [0,4]) {
      const frame = inspectionFrame(sampleMotion(.35, width < 700), 1, topic, width < 700);
      applyComposition(model, frame);
      const fit = fitComposition(model, frame, width / height), half = fit.height / 2;
      const camera = new THREE.OrthographicCamera(-half * width / height, half * width / height, half, -half, .1, 100);
      camera.position.set(fit.x, fit.y, 24); camera.lookAt(fit.x, fit.y, 0); camera.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model.root);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
        const p = new THREE.Vector3(x, y, 0).project(camera);
        assert.ok(.5 + p.x / 2 >= frame.safeLeft - .015 && .5 + p.x / 2 <= frame.safeRight + .015, `horizontal overlap at ${width}`);
        assert.ok(.5 - p.y / 2 >= frame.safeTop - .015 && .5 - p.y / 2 <= frame.safeBottom + .015, `vertical overlap at ${width}`);
      }
    }
    for (let topic = 0; topic <= 4; topic += .1) {
      const frame = inspectionFrame(sampleMotion(.35), 1, topic, width < 700); applyComposition(model, frame);
      assert.ok(Object.values(fitComposition(model, frame, width / height)).every(Number.isFinite));
    }
  }
});

test('torii and sakura have finite geometry, bounded instance cost and frozen reduced motion', () => {
  const world = createCulturalWorld(); let triangles = 0;
  world.root.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    const positions = item.geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    triangles += (item.geometry.index?.count ?? positions.count) / 3 * (item instanceof THREE.InstancedMesh ? item.count : 1);
  });
  assert.ok(triangles < 30000, `cultural props cost ${triangles} triangles`);
  assert.ok(world.root.getObjectByName('Torii'));
  const input = { progress: .87, time: 0, reduced: true, pointerX: .5, pointerY: .5, viewport: { x: 0, y: 0, height: 8, aspect: 1.6 }, swordMatrix: new THREE.Matrix4() };
  world.update(input, 1);
  const petals = world.root.getObjectByName('FallingPetals');
  const still = Array.from(petals.instanceMatrix.array);
  world.update({ ...input, time: 80 }, 1); assert.deepEqual(Array.from(petals.instanceMatrix.array), still);
  world.update({ ...input, reduced: false, time: 80 }, 1); assert.notDeepEqual(Array.from(petals.instanceMatrix.array), still);
  assert.ok(Array.from(petals.instanceMatrix.array).every(Number.isFinite));
  world.update(input, 0); assert.equal(world.root.visible, false);
});
