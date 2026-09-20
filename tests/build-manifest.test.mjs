import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest } from '../scripts/build-manifest.mjs';

async function tempFiles(metadata) {
  const dir = await mkdtemp(join(tmpdir(), 'artisys-map-builder-'));
  const metadataPath = join(dir, 'metadata.json');
  const outputPath = join(dir, 'maps-manifest.json');
  await writeFile(metadataPath, JSON.stringify(metadata));
  return { dir, metadataPath, outputPath };
}

const baseArgs = { releaseVersion: '2026.09.0', generatedAt: '2026-09-20T00:00:00Z' };
const spMetadata = { id: 'sp', version: '2026.09.0', sourceDate: '2026-09-20', size: 123, sha256: 'a'.repeat(64), minZoom: 7, maxZoom: 14 };

test('empty build metadata produces all 28 entries unavailable', async () => {
  const { metadataPath, outputPath } = await tempFiles([]);
  await buildManifest({ metadataPath, outputPath, ...baseArgs });
  const manifest = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(manifest.maps.length, 28);
  assert.ok(manifest.maps.every((entry) => entry.available === false));
});

test('verified metadata for sp produces only sp as available', async () => {
  const { metadataPath, outputPath } = await tempFiles([spMetadata]);
  await buildManifest({ metadataPath, outputPath, ...baseArgs });
  const manifest = JSON.parse(await readFile(outputPath, 'utf8'));
  const available = manifest.maps.filter((entry) => entry.available);
  assert.equal(available.length, 1);
  assert.equal(available[0].id, 'sp');
  assert.equal(available[0].asset, 'sp.pmtiles');
  assert.equal(available[0].sha256, 'a'.repeat(64));
});

test('metadata for unknown catalog ID fails', async () => {
  const { metadataPath, outputPath } = await tempFiles([{ ...spMetadata, id: 'xx' }]);
  await assert.rejects(() => buildManifest({ metadataPath, outputPath, ...baseArgs }), /unknown metadata id: xx/);
});

test('duplicate metadata IDs fail', async () => {
  const { metadataPath, outputPath } = await tempFiles([spMetadata, spMetadata]);
  await assert.rejects(() => buildManifest({ metadataPath, outputPath, ...baseArgs }), /duplicate metadata id: sp/);
});

test('incomplete available metadata fails instead of publishing a partial entry', async () => {
  const broken = { ...spMetadata };
  delete broken.sha256;
  const { metadataPath, outputPath } = await tempFiles([broken]);
  await assert.rejects(() => buildManifest({ metadataPath, outputPath, ...baseArgs }), /metadata sp missing sha256/);
});
