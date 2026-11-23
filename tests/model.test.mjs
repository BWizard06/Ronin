import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKatanaModel } from '../src/scripts/katana-model.ts';

test('the shared model has independent parts, valid meshes and a bounded geometry budget', () => {
  const model = createKatanaModel();
  for (const name of ['blade', 'guard', 'grip', 'saya']) assert.ok(model[name] instanceof THREE.Group);
  let triangles = 0;
  model.root.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    const geometry = item.geometry;
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name);
      assert.ok(attribute, `${item.name}: missing ${name}`);
      assert.ok(attribute.array.every(Number.isFinite), `${item.name}: invalid ${name}`);
    }
    geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    if (geometry.index) assert.ok(geometry.index.array.every(i => i < geometry.getAttribute('position').count));
    triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  });
  assert.ok(triangles > 1000 && triangles < 65000, `triangle budget: ${triangles}`);
  const scabbard = model.saya.getObjectByName('Lacquered scabbard');
  assert.ok(scabbard.geometry.getAttribute('normal').getY(0) > 0.8, 'scabbard exterior must face outwards');
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  assert.ok(bounds.getSize(new THREE.Vector3()).x > 9 && bounds.getSize(new THREE.Vector3()).x < 10);
  for (const texture of model.textures) texture.dispose();
});
