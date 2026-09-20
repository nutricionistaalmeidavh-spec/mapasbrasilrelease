import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';
import { validateManifest } from './lib/manifest.mjs';
import { sha256File } from './lib/sha256.mjs';

const DEFAULT_CATALOG = fileURLToPath(new URL('../catalog/states.json', import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  return args;
}

export async function verifyRelease({ manifestPath, assetsDir, catalogPath = DEFAULT_CATALOG }) {
  const errors = [];
  let manifest;
  let catalog;
  try {
    [manifest, catalog] = await Promise.all([
      readFile(manifestPath, 'utf8').then(JSON.parse),
      loadCatalog(catalogPath)
    ]);
  } catch (error) {
    return { valid: false, errors: [`unable to load release inputs: ${error.message}`] };
  }

  const validation = await validateManifest(manifest, catalog);
  if (!validation.valid) return { valid: false, errors: [...validation.errors] };

  let entries;
  try {
    entries = await readdir(assetsDir, { withFileTypes: true });
  } catch (error) {
    return { valid: false, errors: [`unable to read assets directory: ${error.message}`] };
  }

  const regularFiles = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const expectedAssets = new Map(
    manifest.maps
      .filter((entry) => entry.available)
      .map((entry) => [entry.asset, entry])
  );

  if (regularFiles.has('SHA256SUMS.txt')) {
    try {
      const sumsText = await readFile(join(assetsDir, 'SHA256SUMS.txt'), 'utf8');
      const sums = new Map();
      for (const [index, rawLine] of sumsText.split(/\r?\n/).entries()) {
        if (rawLine.length === 0) continue;
        const match = /^([0-9a-f]{64}) {2}([^/\\]+)$/.exec(rawLine);
        if (!match || match[2].includes('..')) {
          errors.push(`invalid SHA256SUMS line ${index + 1}`);
          continue;
        }
        const [, digest, filename] = match;
        if (sums.has(filename)) {
          errors.push(`duplicate SHA256SUMS entry: ${filename}`);
          continue;
        }
        sums.set(filename, digest);
      }

      for (const [filename, digest] of sums) {
        const expected = expectedAssets.get(filename);
        if (!expected) {
          if (filename.endsWith('.pmtiles')) errors.push(`SHA256SUMS undeclared asset: ${filename}`);
          continue;
        }
        if (digest !== expected.sha256) errors.push(`SHA256SUMS digest mismatch for ${filename}`);
      }
      for (const filename of expectedAssets.keys()) {
        if (!sums.has(filename)) errors.push(`SHA256SUMS missing ${filename}`);
      }
    } catch (error) {
      errors.push(`unable to verify SHA256SUMS.txt: ${error.message}`);
    }
  }

  for (const filename of regularFiles) {
    if (filename.endsWith('.pmtiles') && !expectedAssets.has(filename)) {
      errors.push(`undeclared pmtiles asset: ${filename}`);
    }
  }

  for (const [filename, entry] of expectedAssets) {
    if (!regularFiles.has(filename)) {
      errors.push(`missing asset ${filename}`);
      continue;
    }

    const path = join(assetsDir, filename);
    try {
      const fileStat = await stat(path);
      if (!fileStat.isFile()) {
        errors.push(`asset is not a regular file: ${filename}`);
        continue;
      }
      if (fileStat.size !== entry.size) {
        errors.push(`size mismatch for ${filename}: expected ${entry.size}, got ${fileStat.size}`);
      }
      const digest = await sha256File(path);
      if (digest !== entry.sha256) {
        errors.push(`sha256 mismatch for ${filename}: expected ${entry.sha256}, got ${digest}`);
      }
    } catch (error) {
      errors.push(`unable to verify ${filename}: ${error.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.manifest || !args.assets) throw new Error('Usage: node scripts/verify-release.mjs --manifest <path> --assets <dir>');
    const result = await verifyRelease({ manifestPath: args.manifest, assetsDir: args.assets });
    if (!result.valid) {
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`Release assets valid: ${args.assets}`);
    }
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
