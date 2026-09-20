import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';
import { expectedAssetName, validateManifest } from './lib/manifest.mjs';

const DEFAULT_CATALOG = fileURLToPath(new URL('../catalog/states.json', import.meta.url));

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

function requiredMetadataFields(entry) {
  return ['id', 'version', 'sourceDate', 'size', 'sha256', 'minZoom', 'maxZoom'].filter((field) => entry[field] === undefined || entry[field] === null || entry[field] === '');
}

export async function buildManifest({ catalogPath = DEFAULT_CATALOG, metadataPath, outputPath, releaseVersion, generatedAt }) {
  if (!metadataPath) throw new Error('metadataPath is required');
  if (!outputPath) throw new Error('outputPath is required');
  if (!releaseVersion) throw new Error('releaseVersion is required');
  if (!generatedAt) throw new Error('generatedAt is required');

  const [catalog, metadata] = await Promise.all([loadCatalog(catalogPath), readFile(metadataPath, 'utf8').then(JSON.parse)]);
  if (!Array.isArray(metadata)) throw new Error('build metadata must be an array');

  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const metadataById = new Map();
  for (const entry of metadata) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('metadata entries must be objects');
    if (!catalogById.has(entry.id)) throw new Error(`unknown metadata id: ${entry.id}`);
    if (metadataById.has(entry.id)) throw new Error(`duplicate metadata id: ${entry.id}`);
    const missing = requiredMetadataFields(entry);
    if (missing.length) throw new Error(`metadata ${entry.id} missing ${missing.join(', ')}`);
    metadataById.set(entry.id, entry);
  }

  const manifest = {
    schemaVersion: 1,
    releaseVersion,
    generatedAt,
    source: { provider: 'OpenStreetMap', license: 'ODbL-1.0' },
    maps: catalog.map((stable) => {
      const built = metadataById.get(stable.id);
      if (!built) {
        return { id: stable.id, name: stable.name, kind: stable.kind, available: false, version: null, asset: null, size: null, sha256: null, minZoom: stable.minZoom, maxZoom: stable.maxZoom, bounds: stable.bounds, sourceDate: null };
      }
      return { id: stable.id, name: stable.name, kind: stable.kind, available: true, version: built.version, asset: expectedAssetName(stable.id), size: built.size, sha256: built.sha256, minZoom: built.minZoom, maxZoom: built.maxZoom, bounds: stable.bounds, sourceDate: built.sourceDate };
    })
  };

  const validation = await validateManifest(manifest, catalog);
  if (!validation.valid) throw new Error(`generated manifest invalid: ${validation.errors.join('; ')}`);

  const target = resolve(outputPath);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, target);
  return manifest;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const outputPath = args.output ?? fileURLToPath(new URL('../catalog/maps-manifest.json', import.meta.url));
    const metadataPath = args.metadata ?? fileURLToPath(new URL('../catalog/build-metadata.json', import.meta.url));
    await buildManifest({ metadataPath, outputPath, releaseVersion: args['release-version'], generatedAt: args['generated-at'] });
    console.log(`Manifest built: ${outputPath}`);
  } catch (error) {
    console.error(`Manifest build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
