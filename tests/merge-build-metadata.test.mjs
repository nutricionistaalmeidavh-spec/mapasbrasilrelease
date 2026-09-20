import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeMetadataRows } from '../scripts/merge-build-metadata.mjs';

async function catalogRows() {
  return JSON.parse(await readFile(new URL('../catalog/states.json', import.meta.url), 'utf8'));
}

function metadataFor(entry, overrides = {}) {
  return {
    id: entry.id,
    version: '2026.09.1',
    sourceDate: '2026-09-20',
    size: 1000 + entry.id.length,
    sha256: 'a'.repeat(64),
    minZoom: entry.minZoom,
    maxZoom: entry.maxZoom,
    ...overrides
  };
}

test('P2 metadata assembly requires and orders all 28 catalog packages', async () => {
  const catalog = await catalogRows();
  const shuffled = catalog.map((entry) => metadataFor(entry)).reverse();
  const merged = mergeMetadataRows(shuffled, catalog, {
    releaseVersion: '2026.09.1',
    sourceDate: '2026-09-20'
  });
  assert.equal(merged.length, 28);
  assert.deepEqual(merged.map((row) => row.id), catalog.map((row) => row.id));
});

test('P2 metadata assembly fails closed for missing, duplicate or inconsistent rows', async () => {
  const catalog = await catalogRows();
  const rows = catalog.map((entry) => metadataFor(entry));
  assert.throws(() => mergeMetadataRows(rows.slice(1), catalog, {
    releaseVersion: '2026.09.1', sourceDate: '2026-09-20'
  }), /missing metadata/);
  assert.throws(() => mergeMetadataRows([...rows, rows[0]], catalog, {
    releaseVersion: '2026.09.1', sourceDate: '2026-09-20'
  }), /duplicate metadata/);
  assert.throws(() => mergeMetadataRows(rows.map((row, index) => index === 3 ? {...row, version: '2026.09.0'} : row), catalog, {
    releaseVersion: '2026.09.1', sourceDate: '2026-09-20'
  }), /release version mismatch/);
});
