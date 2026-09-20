import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBuildMetadata } from '../scripts/create-build-metadata.mjs';
import { createHash } from 'node:crypto';

const digest = (text) => createHash('sha256').update(text).digest('hex');

test('build metadata uses real file size/hash and catalog zooms', async () => {
  const dir = await mkdtemp(join(tmpdir(),'maps-meta-'));
  await writeFile(join(dir,'brasil-base.pmtiles'),'BRAZIL');
  await writeFile(join(dir,'sp.pmtiles'),'SPDATA');
  const out = join(dir,'build-metadata.json');
  const rows = await createBuildMetadata({ids:['brasil-base','sp'], assetsDir:dir, releaseVersion:'2026.09.0', sourceDate:'2026-09-18', outputPath:out});
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {id:'brasil-base',version:'2026.09.0',sourceDate:'2026-09-18',size:6,sha256:digest('BRAZIL'),minZoom:0,maxZoom:7});
  assert.deepEqual(rows[1], {id:'sp',version:'2026.09.0',sourceDate:'2026-09-18',size:6,sha256:digest('SPDATA'),minZoom:7,maxZoom:14});
  assert.deepEqual(JSON.parse(await readFile(out,'utf8')), rows);
});

test('build metadata fails when expected PMTiles is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(),'maps-meta-missing-'));
  await assert.rejects(() => createBuildMetadata({ids:['sp'],assetsDir:dir,releaseVersion:'2026.09.0',sourceDate:'2026-09-18',outputPath:join(dir,'out.json')}), /sp\.pmtiles/);
});
