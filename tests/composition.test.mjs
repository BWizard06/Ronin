import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKatanaModel } from '../src/scripts/katana-model.ts';
import { applyComposition, fitComposition } from '../src/scripts/composition.ts';
import { sampleMotion } from '../src/scripts/motion.mjs';

const sizes = [[320, 800], [390, 844], [390, 600], [768, 1024], [1024, 768], [1440, 900], [2560, 1080], [844, 390]];
const model = createKatanaModel();

function projectFullView(width, height, progress, rotation = 0, tilt = 0) {
  const frame = sampleMotion(progress, width < 700);
  applyComposition(model, frame, rotation, tilt);
  const fit = fitComposition(model, frame, width / height);
  const half = fit.height / 2;
  const camera = new THREE.OrthographicCamera(-half * width / height, half * width / height, half, -half, .1, 100);
  camera.position.set(fit.x, fit.y, 24); camera.lookAt(fit.x, fit.y, 0); camera.updateMatrixWorld(true);
  // Check the actual visible objects, not a second copy of the fitting formula.
  const actualBounds = new THREE.Box3().setFromObject(progress === .26 ? model.sword : model.root);
  const label = `${width}x${height}, p=${progress}, rotation=${rotation}, tilt=${tilt}`;
  for (const x of [actualBounds.min.x, actualBounds.max.x]) for (const y of [actualBounds.min.y, actualBounds.max.y]) for (const z of [actualBounds.min.z, actualBounds.max.z]) {
    const projected = new THREE.Vector3(x, y, z).project(camera);
    const screenX = .5 + projected.x / 2, screenY = .5 - projected.y / 2;
    assert.ok(screenX >= frame.safeLeft - .015 && screenX <= frame.safeRight + .015, `horizontal crop: ${label}, x=${screenX}`);
    assert.ok(screenY >= frame.safeTop - .015 && screenY <= frame.safeBottom + .015, `vertical crop: ${label}, y=${screenY}`);
  }
}

test('complete katana fits at the opening, reveal, parts view and ending on eight viewport shapes', () => {
  for (const [width, height] of sizes) for (const progress of [0, .26, .74, .80, 1]) projectFullView(width, height, progress);
});
test('free rotation keeps both the sword and the sheath inside the frame', () => {
  for (const [width, height] of sizes) for (const rotation of [-1.35, 0, 1.35]) for (const tilt of [-.5, .5]) projectFullView(width, height, 1, rotation, tilt);
});
test('camera framing stays finite through all transitions on desktop and portrait', () => {
  for (const [width, height] of [[390, 844], [1440, 900]]) for (let i = 0; i <= 300; i++) {
    const frame = sampleMotion(i / 300, width < 700); applyComposition(model, frame);
    const fit = fitComposition(model, frame, width / height);
    assert.ok([fit.x, fit.y, fit.height].every(Number.isFinite));
    assert.ok(fit.height >= 2 && fit.height < 40);
  }
});
