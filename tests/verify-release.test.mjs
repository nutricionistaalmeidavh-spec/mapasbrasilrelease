import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRelease } from '../scripts/verify-release.mjs';

const baseManifestPath = fileURLToPath(new URL('../catalog/maps-manifest.json', import.meta.url));

async function prepare({ bytes = Buffer.from('pmtiles-test'), manifestMutator, extraFiles = [] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'artisys-release-'));
  const manifest = JSON.parse(await readFile(baseManifestPath, 'utf8'));
  if (manifestMutator) await manifestMutator(manifest, bytes);
  const manifestPath = join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  for (const [name, content] of extraFiles) await writeFile(join(dir, name), content);
  return { dir, manifest, manifestPath };
}

function makeAvailable(manifest, bytes) {
  const sp = manifest.maps.find((entry) => entry.id === 'sp');
  sp.available = true;
  sp.version = '2026.09.0';
  sp.asset = 'sp.pmtiles';
  sp.size = bytes.length;
  sp.sha256 = createHash('sha256').update(bytes).digest('hex');
  sp.sourceDate = '2026-09-20';
  return sp;
}

test('release with no available packages validates against an empty directory', async () => {
  const { dir, manifestPath } = await prepare();
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('available asset with matching size and sha256 passes', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => makeAvailable(manifest, bytes),
    extraFiles: [['sp.pmtiles', bytes]]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('missing declared asset fails', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({ bytes, manifestMutator: (manifest) => makeAvailable(manifest, bytes) });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('missing asset sp.pmtiles')));
});

test('same filename with wrong bytes fails sha256 verification', async () => {
  const expected = Buffer.from('pmtiles-test');
  const wrong = Buffer.from('pmtiles-bad!');
  const { dir, manifestPath } = await prepare({
    bytes: expected,
    manifestMutator: (manifest) => makeAvailable(manifest, expected),
    extraFiles: [['sp.pmtiles', wrong]]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('sha256 mismatch for sp.pmtiles')));
});

test('same digest expectation with wrong byte size fails', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => {
      const sp = makeAvailable(manifest, bytes);
      sp.size = bytes.length + 1;
    },
    extraFiles: [['sp.pmtiles', bytes]]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('size mismatch for sp.pmtiles')));
});

test('undeclared pmtiles asset is rejected', async () => {
  const { dir, manifestPath } = await prepare({ extraFiles: [['xx.pmtiles', Buffer.from('x')]] });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('undeclared pmtiles asset: xx.pmtiles')));
});

test('path-like asset name is rejected before filesystem access', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => {
      const sp = makeAvailable(manifest, bytes);
      sp.asset = '../sp.pmtiles';
    }
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unsafe asset name')));
});

test('SHA256SUMS matching manifest and asset passes', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => makeAvailable(manifest, bytes),
    extraFiles: [
      ['sp.pmtiles', bytes],
      ['SHA256SUMS.txt', `${digest}  sp.pmtiles\n`]
    ]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('SHA256SUMS digest must match manifest digest', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => makeAvailable(manifest, bytes),
    extraFiles: [
      ['sp.pmtiles', bytes],
      ['SHA256SUMS.txt', `${'b'.repeat(64)}  sp.pmtiles\n`]
    ]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('SHA256SUMS digest mismatch for sp.pmtiles')));
});

test('SHA256SUMS must include every manifest-declared available asset', async () => {
  const bytes = Buffer.from('pmtiles-test');
  const { dir, manifestPath } = await prepare({
    bytes,
    manifestMutator: (manifest) => makeAvailable(manifest, bytes),
    extraFiles: [
      ['sp.pmtiles', bytes],
      ['SHA256SUMS.txt', '']
    ]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('SHA256SUMS missing sp.pmtiles')));
});

test('SHA256SUMS rejects undeclared pmtiles names', async () => {
  const { dir, manifestPath } = await prepare({
    extraFiles: [['SHA256SUMS.txt', `${'a'.repeat(64)}  xx.pmtiles\n`]]
  });
  const result = await verifyRelease({ manifestPath, assetsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('SHA256SUMS undeclared asset: xx.pmtiles')));
});
