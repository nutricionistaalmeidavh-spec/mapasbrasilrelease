import { loadCatalog } from './lib/catalog.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assetName(id) { return id === 'brasil-base' ? 'brasil-base.pmtiles' : `${id}.pmtiles`; }

export async function buildExtractPlan(ids, catalogPath) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('at least one id is required');
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`duplicate id: ${id}`);
    seen.add(id);
  }
  const catalog = await loadCatalog(catalogPath);
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  return ids.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`unknown catalog id: ${id}`);
    return {
      id,
      asset: assetName(id),
      bbox: entry.bounds.join(','),
      minZoom: entry.minZoom,
      maxZoom: entry.maxZoom
    };
  });
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
    const ids = (args.ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    const plan = await buildExtractPlan(ids, args.catalog);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } catch (error) {
    console.error(`Extract plan failed: ${error.message}`);
    process.exitCode = 1;
  }
}
