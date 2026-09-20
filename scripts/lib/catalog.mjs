import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEFAULT_CATALOG = fileURLToPath(new URL('../../catalog/states.json', import.meta.url));

export const EXPECTED_IDS = Object.freeze([
  'brasil-base',
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms',
  'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp',
  'se', 'to'
]);

export async function loadCatalog(path = DEFAULT_CATALOG) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('catalog must be an array');
  return parsed;
}
