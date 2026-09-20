import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReleaseAssetIndex } from '../scripts/verify-release-index.mjs';

const manifest = {
  maps: [
    { id: 'brasil-base', available: true, asset: 'brasil-base.pmtiles', size: 10, sha256: 'a'.repeat(64) },
    { id: 'sp', available: true, asset: 'sp.pmtiles', size: 20, sha256: 'b'.repeat(64) }
  ]
};

const goodAssets = [
  { name: 'brasil-base.pmtiles', size: 10, digest: `sha256:${'a'.repeat(64)}` },
  { name: 'sp.pmtiles', size: 20, digest: `sha256:${'b'.repeat(64)}` },
  { name: 'maps-manifest.json', size: 100, digest: `sha256:${'c'.repeat(64)}` }
];

test('release index verifies declared PMTiles by exact size and GitHub digest', () => {
  const result = verifyReleaseAssetIndex(manifest, goodAssets, { requireAll: false });
  assert.deepEqual(result.verified, ['brasil-base.pmtiles', 'sp.pmtiles']);
});

test('release index fails closed for wrong digest, missing asset or undeclared PMTiles', () => {
  assert.throws(() => verifyReleaseAssetIndex(manifest, goodAssets.map((asset) => asset.name === 'sp.pmtiles' ? {...asset, digest: `sha256:${'d'.repeat(64)}`} : asset), { requireAll: false }), /digest mismatch/);
  assert.throws(() => verifyReleaseAssetIndex(manifest, goodAssets.filter((asset) => asset.name !== 'sp.pmtiles'), { requireAll: false }), /missing release asset/);
  assert.throws(() => verifyReleaseAssetIndex(manifest, [...goodAssets, { name: 'xx.pmtiles', size: 1, digest: `sha256:${'e'.repeat(64)}` }], { requireAll: false }), /undeclared pmtiles/);
});

test('P2 requireAll rejects manifests that do not expose 28 available packages', () => {
  assert.throws(() => verifyReleaseAssetIndex(manifest, goodAssets, { requireAll: true }), /28 available packages/);
});
