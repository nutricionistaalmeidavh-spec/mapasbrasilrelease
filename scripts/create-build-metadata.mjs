import { stat, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';
import { sha256File } from './lib/sha256.mjs';
import { isSourceDate } from './lib/daily-source.mjs';

const RELEASE_VERSION_RE = /^\d{4}\.\d{2}\.\d+$/;
function assetName(id) { return id === 'brasil-base' ? 'brasil-base.pmtiles' : `${id}.pmtiles`; }

export async function createBuildMetadata({ ids, assetsDir, releaseVersion, sourceDate, outputPath, catalogPath }) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids are required');
  if (!assetsDir) throw new Error('assetsDir is required');
  if (!RELEASE_VERSION_RE.test(releaseVersion ?? '')) throw new Error('releaseVersion must match YYYY.MM.PATCH');
  if (!isSourceDate(sourceDate)) throw new Error('sourceDate must be a real YYYY-MM-DD date');
  if (!outputPath) throw new Error('outputPath is required');
  if (new Set(ids).size !== ids.length) throw new Error('duplicate ids are not allowed');

  const catalog = await loadCatalog(catalogPath);
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const rows = [];
  for (const id of ids) {
    const stable = byId.get(id);
    if (!stable) throw new Error(`unknown catalog id: ${id}`);
    const path = join(assetsDir, assetName(id));
    let fileStat;
    try { fileStat = await stat(path); } catch { throw new Error(`missing map asset: ${assetName(id)}`); }
    if (!fileStat.isFile() || fileStat.size <= 0) throw new Error(`invalid map asset: ${assetName(id)}`);
    rows.push({
      id,
      version: releaseVersion,
      sourceDate,
      size: fileStat.size,
      sha256: await sha256File(path),
      minZoom: stable.minZoom,
      maxZoom: stable.maxZoom
    });
  }

  const target = resolve(outputPath);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, `${JSON.stringify(rows, null, 2)}\n`);
  await rename(tmp, target);
  return rows;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  return args;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rows = await createBuildMetadata({
      ids: (args.ids ?? '').split(',').map((v) => v.trim()).filter(Boolean),
      assetsDir: args.assets,
      releaseVersion: args['release-version'],
      sourceDate: args['source-date'],
      outputPath: args.output,
      catalogPath: args.catalog
    });
    console.log(`Build metadata written: ${args.output} (${rows.length} maps)`);
  } catch (error) {
    console.error(`Build metadata failed: ${error.message}`);
    process.exitCode = 1;
  }
}
