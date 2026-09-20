import test from 'node:test';
import assert from 'node:assert/strict';
import { buildP2Matrix } from '../scripts/build-p2-matrix.mjs';

test('P2 matrix contains Brasil base plus all 26 states and DF exactly once', async () => {
  const matrix = await buildP2Matrix();
  assert.equal(matrix.include.length, 28);
  assert.equal(new Set(matrix.include.map((row) => row.id)).size, 28);
  assert.equal(matrix.include[0].id, 'brasil-base');
  assert.equal(matrix.include[0].asset, 'brasil-base.pmtiles');
  assert.deepEqual(matrix.include.find((row) => row.id === 'sp'), {
    id: 'sp',
    asset: 'sp.pmtiles',
    bbox: '-53.2,-25.4,-44.1,-19.7',
    minZoom: 7,
    maxZoom: 14
  });
});

test('P2 matrix preserves catalog order and deterministic asset names', async () => {
  const matrix = await buildP2Matrix();
  assert.deepEqual(matrix.include.slice(0, 5).map((row) => row.id), ['brasil-base', 'ac', 'al', 'ap', 'am']);
  assert.equal(matrix.include.find((row) => row.id === 'df').asset, 'df.pmtiles');
  assert.equal(matrix.include.at(-1).asset, 'to.pmtiles');
});
