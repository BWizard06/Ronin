import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererSize } from '../src/scripts/renderer-size.mjs';

function surface() {
  let ratio = 1, pixels = 'drawn', width = 300, height = 150;
  const allocations = [];
  const renderer = {
    getPixelRatio: () => ratio,
    setPixelRatio(value) { ratio = value; this.setSize(width, height, false); },
    setSize(w, h, style) { width = w; height = h; pixels = 'cleared'; allocations.push([w, h, ratio, style]); },
  };
  const size = createRendererSize(renderer);
  const draw = () => { const frame = size.apply(); if (frame) pixels = 'drawn'; return frame; };
  return { size, draw, allocations, pixels: () => pixels };
}

test('browser toolbar resize notifications preserve the last frame until the next render', () => {
  const view = surface();
  view.size.request(390, 664, 1.5); view.draw();
  view.allocations.length = 0;
  // ResizeObserver runs after animation callbacks, before compositing. It must
  // not erase the frame that is about to be shown, even during rapid resizing.
  for (let height = 665; height <= 844; height++) {
    view.size.request(390, height, 1.5);
    assert.equal(view.pixels(), 'drawn');
  }
  assert.deepEqual(view.allocations, []);
  assert.deepEqual(view.draw(), { width: 390, height: 844, pixelRatio: 1.5 });
  assert.deepEqual(view.allocations, [[390, 844, 1.5, false]]);
  assert.equal(view.pixels(), 'drawn');
});

test('repeated measurements, subpixel jitter and ambient frames do not reallocate the buffer', () => {
  const view = surface();
  view.size.request(390, 844, 1.5); view.draw();
  view.allocations.length = 0;
  for (let i = 0; i < 120; i++) {
    assert.equal(view.size.request(390 + Math.sin(i) * .2, 844 + Math.cos(i) * .2, 1.5), false);
    view.draw();
  }
  assert.deepEqual(view.allocations, []);
});

test('orientation and pixel density changes still resize, while hidden or invalid bounds retain the frame', () => {
  const view = surface();
  assert.equal(view.size.apply(), null);
  view.size.request(390, 844, 1.5); view.draw();
  assert.equal(view.size.request(844, 390, 1.5), true);
  assert.deepEqual(view.draw(), { width: 844, height: 390, pixelRatio: 1.5 });
  assert.equal(view.size.request(844, 390, 1), true);
  assert.deepEqual(view.draw(), { width: 844, height: 390, pixelRatio: 1 });
  view.allocations.length = 0;
  for (const values of [[0, 0, 1], [390, NaN, 1.5], [Infinity, 844, 1], [390, 844, 0]]) assert.equal(view.size.request(...values), false);
  assert.deepEqual(view.draw(), { width: 844, height: 390, pixelRatio: 1 });
  assert.deepEqual(view.allocations, []);
});

test('a resize that returns to the current viewport before rendering does not clear the canvas', () => {
  const view = surface();
  view.size.request(390, 844, 1.5); view.draw();
  view.allocations.length = 0;
  view.size.request(390, 800, 1.5);
  view.size.request(390, 844, 1.5);
  view.draw();
  assert.deepEqual(view.allocations, []);
});
