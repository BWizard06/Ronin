import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAssetBuffer } from '../src/scripts/asset-loading.ts';
import { createLoadProgress } from '../src/scripts/load-progress.mjs';

test('download progress follows streamed bytes but reserves completion for decoding and installation', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1,2])); controller.enqueue(new Uint8Array([3,4,5,6])); controller.close(); },
  }), { headers: { 'content-length': '6' } }));
  const progress=[];
  const buffer=await fetchAssetBuffer('/model.glb', new AbortController().signal, value=>progress.push(value));
  assert.deepEqual([...new Uint8Array(buffer)], [1,2,3,4,5,6]);
  assert.equal(progress[0], .3); assert.equal(progress.at(-1), .9);
  assert.ok(progress.every(value=>value<=.9));
});

test('compressed or unknown length responses complete without invented byte percentages', async t => {
  for(const headers of [{}, {'content-length':'2','content-encoding':'gzip'}]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1,2,3,4]), {headers}));
    const progress=[];
    await fetchAssetBuffer('/model.glb', new AbortController().signal, value=>progress.push(value));
    assert.deepEqual(progress,[.9]);
    t.mock.restoreAll();
  }
});

test('failed, interrupted and cancelled transfers do not report a finished download', async t => {
  const progress=[];
  t.mock.method(globalThis, 'fetch', async () => new Response('', {status:404}));
  await assert.rejects(fetchAssetBuffer('/missing.glb', new AbortController().signal, value=>progress.push(value)), /404/);
  assert.deepEqual(progress,[]);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1])); },
    pull(controller) { controller.error(new Error('Connection lost')); },
  }), {headers:{'content-length':'100'}}));
  await assert.rejects(fetchAssetBuffer('/broken.glb', new AbortController().signal, value=>progress.push(value)), /Connection lost/);
  assert.ok(progress.every(value=>value<.9));
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1])));
  const abort=new AbortController();abort.abort();
  await assert.rejects(fetchAssetBuffer('/cancelled.glb', abort.signal, ()=>assert.fail('cancelled transfer progressed')), {name:'AbortError'});
});

test('100% requires every model, fonts, code and the completed rendered frame', () => {
  const values=[],report=createLoadProgress(value=>values.push(value));
  for(const task of ['engine','katana','saya','torii','sakura'])report(task,1);
  assert.equal(values.at(-1),90);
  report('fonts',1); assert.equal(values.at(-1),95);
  report('scene',.8); assert.equal(values.at(-1),99);
  report('katana',.2); assert.equal(values.at(-1),99,'late byte progress cannot move the display backwards');
  report('scene',1); assert.equal(values.at(-1),100);
  assert.ok(values.every((value,index)=>index===0||value>=values[index-1]));
});
