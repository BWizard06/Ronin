import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REST_POSES, sampleMotion, reducedProgress, scrollProgress } from '../src/scripts/motion.mjs';
import { editorialState } from '../src/scripts/editorial-motion.mjs';

test('scroll position is bounded for initial load, restored scroll and overscroll', () => {
  assert.equal(scrollProgress(20, 7600, 1000), 0);
  assert.equal(scrollProgress(-3300, 7600, 1000), .5);
  assert.equal(scrollProgress(-9000, 7600, 1000), 1);
  assert.equal(scrollProgress(0, 1000, 1000), 0);
});
test('reduced-motion compositions retain the keywords and deliberate object-only pauses', () => {
  for (const [index, progress] of REST_POSES.entries()) {
    const editorial = editorialState(progress);
    const expected=['opening','craft',null,'glass',null,'hand','assembly',null,'return'][index];
    assert.equal(editorial.active,expected);
    if(expected)assert.equal(editorial.opacity[expected],1);
    assert.equal(reducedProgress(progress), progress);
  }
});
test('movement is continuous, deterministic and assembles back into a whole', () => {
  const properties = ['rotationX', 'rotationY', 'rotationZ', 'zoom', 'focusX', 'focusY', 'detailHeight', 'sayaX', 'sayaY', 'sayaAngle', 'draw', 'separation', 'dark', 'red', 'free'];
  for (const mobile of [false, true]) {
    let previous = sampleMotion(0, mobile);
    for (let i = 1; i <= 2000; i++) {
      const frame = sampleMotion(i / 2000, mobile);
      for (const property of properties) {
        assert.ok(Number.isFinite(frame[property]), `${property} at ${i}`);
        assert.ok(Math.abs(frame[property] - previous[property]) < .08, `${property} jumps at ${i}`);
      }
      assert.ok(frame.draw >= previous.draw);
      previous = frame;
    }
    assert.deepEqual(sampleMotion(0, mobile), sampleMotion(-1, mobile));
    assert.deepEqual(sampleMotion(1, mobile), sampleMotion(2, mobile));
    assert.deepEqual(sampleMotion(NaN, mobile), sampleMotion(0, mobile));
    assert.equal(sampleMotion(0, mobile).separation, 0);
    assert.equal(sampleMotion(.74, mobile).separation, 1);
    assert.equal(sampleMotion(1, mobile).separation, 0);
    assert.ok(sampleMotion(.58, mobile).rotationX - sampleMotion(0, mobile).rotationX >= Math.PI * 2);
  }
});
