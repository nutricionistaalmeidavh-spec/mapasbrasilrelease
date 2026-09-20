import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateBuilds, resolveDailyBuild } from '../scripts/lib/daily-source.mjs';

test('candidateBuilds returns newest-to-oldest UTC build dates', () => {
  const rows = candidateBuilds(new Date('2026-09-20T12:00:00Z'), 3);
  assert.deepEqual(rows.map((x) => x.build), ['20260920','20260919','20260918']);
  assert.equal(rows[0].url, 'https://build.protomaps.com/20260920.pmtiles');
});

test('resolveDailyBuild selects first remotely available candidate', async () => {
  const seen = [];
  const result = await resolveDailyBuild({
    now: new Date('2026-09-20T12:00:00Z'), days: 4,
    probe: async (candidate) => { seen.push(candidate.build); return candidate.build === '20260918'; }
  });
  assert.equal(result.build, '20260918');
  assert.equal(result.sourceDate, '2026-09-18');
  assert.deepEqual(seen, ['20260920','20260919','20260918']);
});

test('resolveDailyBuild fails closed when no recent build is available', async () => {
  await assert.rejects(() => resolveDailyBuild({ now: new Date('2026-09-20T12:00:00Z'), days: 2, probe: async () => false }), /no Protomaps daily build/);
});
