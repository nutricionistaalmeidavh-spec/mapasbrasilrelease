import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function selectReusableDraftRelease(releases, { tag, name }) {
  if (!Array.isArray(releases)) throw new Error('releases must be an array');
  if (!tag || !name) throw new Error('tag and name are required');
  const matches = releases.filter((release) => release?.draft === true && (release.tag_name === tag || release.name === name));
  if (matches.length > 1) throw new Error(`ambiguous draft releases for ${tag}/${name}`);
  return matches[0] ?? null;
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
    if (!args.releases) throw new Error('--releases is required');
    const releases = JSON.parse(await readFile(args.releases, 'utf8'));
    const selected = selectReusableDraftRelease(releases, { tag: args.tag, name: args.name });
    if (selected) process.stdout.write(`${selected.id}\n`);
  } catch (error) {
    console.error(`Draft release selection failed: ${error.message}`);
    process.exitCode = 1;
  }
}
