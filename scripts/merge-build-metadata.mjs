import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;

export function mergeMetadataRows(rows, catalog, { releaseVersion, sourceDate }) {
  if (!Array.isArray(rows)) throw new Error('metadata rows must be an array');
  if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('catalog must be a non-empty array');
  const byId = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error('metadata row must be an object');
    if (byId.has(row.id)) throw new Error(`duplicate metadata: ${row.id}`);
    byId.set(row.id, row);
  }

  const catalogIds = new Set(catalog.map((entry) => entry.id));
  for (const id of byId.keys()) {
    if (!catalogIds.has(id)) throw new Error(`unknown metadata id: ${id}`);
  }

  return catalog.map((entry) => {
    const row = byId.get(entry.id);
    if (!row) throw new Error(`missing metadata: ${entry.id}`);
    if (row.version !== releaseVersion) throw new Error(`release version mismatch for ${entry.id}`);
    if (row.sourceDate !== sourceDate) throw new Error(`source date mismatch for ${entry.id}`);
    if (!Number.isInteger(row.size) || row.size <= 0) throw new Error(`invalid size for ${entry.id}`);
    if (!SHA256_RE.test(row.sha256 ?? '')) throw new Error(`invalid sha256 for ${entry.id}`);
    if (row.minZoom !== entry.minZoom || row.maxZoom !== entry.maxZoom) {
      throw new Error(`zoom mismatch for ${entry.id}`);
    }
    return row;
  });
}

async function readRows(metadataDir) {
  const names = (await readdir(metadataDir)).filter((name) => name.endsWith('.metadata.json')).sort();
  const rows = [];
  for (const name of names) {
    const parsed = JSON.parse(await readFile(join(metadataDir, name), 'utf8'));
    if (Array.isArray(parsed)) rows.push(...parsed);
    else rows.push(parsed);
  }
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

export async function mergeBuildMetadata({ metadataDir, outputPath, releaseVersion, sourceDate, catalogPath }) {
  if (!metadataDir) throw new Error('metadataDir is required');
  if (!outputPath) throw new Error('outputPath is required');
  const catalog = await loadCatalog(catalogPath);
  const rows = mergeMetadataRows(await readRows(metadataDir), catalog, { releaseVersion, sourceDate });
  const target = resolve(outputPath);
  const tmp = `${target}.tmp`;
  await writeFile(tmp, `${JSON.stringify(rows, null, 2)}\n`);
  await rename(tmp, target);
  return rows;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rows = await mergeBuildMetadata({
      metadataDir: args.dir,
      outputPath: args.output,
      releaseVersion: args['release-version'],
      sourceDate: args['source-date'],
      catalogPath: args.catalog
    });
    console.log(`Merged P2 metadata: ${rows.length} packages`);
  } catch (error) {
    console.error(`P2 metadata merge failed: ${error.message}`);
    process.exitCode = 1;
  }
}
