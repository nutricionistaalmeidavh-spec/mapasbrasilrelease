import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';

function assetName(id) {
  return id === 'brasil-base' ? 'brasil-base.pmtiles' : `${id}.pmtiles`;
}

export async function buildP2Matrix(catalogPath) {
  const catalog = await loadCatalog(catalogPath);
  return {
    include: catalog.map((entry) => ({
      id: entry.id,
      asset: assetName(entry.id),
      bbox: entry.bounds.join(','),
      minZoom: entry.minZoom,
      maxZoom: entry.maxZoom
    }))
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const matrix = await buildP2Matrix();
    process.stdout.write(`${JSON.stringify(matrix)}\n`);
  } catch (error) {
    console.error(`P2 matrix failed: ${error.message}`);
    process.exitCode = 1;
  }
}
