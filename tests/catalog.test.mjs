import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, EXPECTED_IDS } from '../scripts/lib/catalog.mjs';

test('catalog contains brasil-base plus all 26 states and DF exactly once', async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.length, 28);
  assert.deepEqual(catalog.map((entry) => entry.id), EXPECTED_IDS);
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 28);
});

test('catalog entries expose safe zooms and ordered finite bounds', async () => {
  const catalog = await loadCatalog();
  for (const entry of catalog) {
    assert.ok(Number.isInteger(entry.minZoom));
    assert.ok(Number.isInteger(entry.maxZoom));
    assert.ok(entry.minZoom <= entry.maxZoom);
    assert.equal(entry.bounds.length, 4);
    const [west, south, east, north] = entry.bounds;
    assert.ok([west, south, east, north].every(Number.isFinite));
    assert.ok(west < east);
    assert.ok(south < north);
  }
});
