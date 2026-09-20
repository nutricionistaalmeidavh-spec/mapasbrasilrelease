import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyReleaseAssetIndex(manifest, assets, { requireAll = true } = {}) {
  if (!manifest || !Array.isArray(manifest.maps)) throw new Error('manifest maps must be an array');
  if (!Array.isArray(assets)) throw new Error('release assets must be an array');

  const available = manifest.maps.filter((map) => map.available === true);
  if (requireAll && available.length !== 28) {
    throw new Error(`P2 requires 28 available packages; got ${available.length}`);
  }

  const assetsByName = new Map();
  for (const asset of assets) {
    if (!asset?.name) throw new Error('release asset without name');
    if (assetsByName.has(asset.name)) throw new Error(`duplicate release asset: ${asset.name}`);
    assetsByName.set(asset.name, asset);
  }

  const declaredPmtiles = new Set(available.map((map) => map.asset));
  for (const asset of assets) {
    if (asset.name.endsWith('.pmtiles') && !declaredPmtiles.has(asset.name)) {
      throw new Error(`undeclared pmtiles release asset: ${asset.name}`);
    }
  }

  const verified = [];
  for (const map of available) {
    const asset = assetsByName.get(map.asset);
    if (!asset) throw new Error(`missing release asset: ${map.asset}`);
    if (asset.size !== map.size) throw new Error(`size mismatch for ${map.asset}`);
    const expectedDigest = `sha256:${map.sha256}`;
    if (asset.digest !== expectedDigest) throw new Error(`digest mismatch for ${map.asset}`);
    verified.push(map.asset);
  }

  return { verified };
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
    const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
    const assets = JSON.parse(await readFile(args.assets, 'utf8'));
    const requireAll = args['require-all'] !== 'false';
    const result = verifyReleaseAssetIndex(manifest, assets, { requireAll });
    console.log(`Release asset index verified: ${result.verified.length} PMTiles`);
  } catch (error) {
    console.error(`Release asset index verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
