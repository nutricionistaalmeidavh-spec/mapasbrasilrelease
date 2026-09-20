import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../scripts/lib/catalog.mjs';
import { validateManifest } from '../scripts/lib/manifest.mjs';

const manifestPath = fileURLToPath(new URL('../catalog/maps-manifest.json', import.meta.url));
const clone = (value) => structuredClone(value);

async function loadFixture() {
  const [catalog, manifest] = await Promise.all([loadCatalog(), readFile(manifestPath, 'utf8').then(JSON.parse)]);
  return { catalog, manifest };
}

function makeSpAvailable(manifest) {
  const sp = manifest.maps.find((map) => map.id === 'sp');
  sp.available = true;
  sp.version = '2026.09.0';
  sp.asset = 'sp.pmtiles';
  sp.size = 123;
  sp.sha256 = 'a'.repeat(64);
  sp.sourceDate = '2026-09-20';
  return sp;
}

test('initial manifest validates with all 28 packages unavailable', async () => {
  const { catalog, manifest } = await loadFixture();
  assert.deepEqual(await validateManifest(manifest, catalog), { valid: true, errors: [] });
});

test('missing catalog ID fails validation', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps.pop();
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('missing catalog id')));
});

test('duplicate geographic ID fails validation', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps[27] = clone(manifest.maps[26]);
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('duplicate id')));
});

test('unknown geographic ID fails validation', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps[27].id = 'xx';
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unknown id')));
});

test('available entry requires version asset size sha256 and sourceDate', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps.find((map) => map.id === 'sp').available = true;
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('available entry sp requires')));
});

test('unavailable entry rejects release-specific metadata', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps.find((map) => map.id === 'sp').asset = 'sp.pmtiles';
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unavailable entry sp')));
});

test('asset path separators and dot-dot are rejected', async () => {
  for (const asset of ['../sp.pmtiles', 'maps/sp.pmtiles', 'maps\\sp.pmtiles']) {
    const { catalog, manifest } = await loadFixture();
    const sp = makeSpAvailable(manifest);
    sp.asset = asset;
    const result = await validateManifest(manifest, catalog);
    assert.equal(result.valid, false, asset);
    assert.ok(result.errors.some((error) => error.includes('unsafe asset name')), asset);
  }
});

test('sha256 must be 64 lowercase hexadecimal characters', async () => {
  const { catalog, manifest } = await loadFixture();
  makeSpAvailable(manifest).sha256 = 'A'.repeat(64);
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('invalid sha256')));
});

test('size must be a positive integer when available', async () => {
  const { catalog, manifest } = await loadFixture();
  makeSpAvailable(manifest).size = 0;
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('invalid size')));
});

test('invalid zoom range fails validation', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps.find((map) => map.id === 'sp').minZoom = 15;
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('stable field mismatch') || error.includes('zoom')));
});

test('invalid bounds order fails validation', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.maps.find((map) => map.id === 'sp').bounds = [-44, -19, -53, -25];
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('invalid bounds')));
});

test('releaseVersion must match YYYY.MM.PATCH', async () => {
  const { catalog, manifest } = await loadFixture();
  manifest.releaseVersion = 'v1';
  const result = await validateManifest(manifest, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('releaseVersion')));
});
