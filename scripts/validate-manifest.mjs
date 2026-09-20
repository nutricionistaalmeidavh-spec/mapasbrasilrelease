import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';
import { validateManifest } from './lib/manifest.mjs';

const defaultManifest = fileURLToPath(new URL('../catalog/maps-manifest.json', import.meta.url));
const defaultCatalog = fileURLToPath(new URL('../catalog/states.json', import.meta.url));
const manifestPath = process.argv[2] ?? defaultManifest;
const catalogPath = process.argv[3] ?? defaultCatalog;

try {
  const [manifest, catalog] = await Promise.all([readFile(manifestPath, 'utf8').then(JSON.parse), loadCatalog(catalogPath)]);
  const result = await validateManifest(manifest, catalog);
  if (!result.valid) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Manifest valid: ${manifestPath}`);
  }
} catch (error) {
  console.error(`Manifest validation failed: ${error.message}`);
  process.exitCode = 1;
}
