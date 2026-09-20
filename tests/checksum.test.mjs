import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sha256File } from '../scripts/lib/sha256.mjs';

const fixture = fileURLToPath(new URL('./fixtures/checksum-sample.txt', import.meta.url));

test('sha256File streams a file and returns lowercase 64-char digest', async () => {
  const expected = createHash('sha256').update(Buffer.from('ArtiSys Mapas Brasil\n')).digest('hex');
  const actual = await sha256File(fixture);
  assert.equal(actual, expected);
  assert.match(actual, /^[0-9a-f]{64}$/);
});
