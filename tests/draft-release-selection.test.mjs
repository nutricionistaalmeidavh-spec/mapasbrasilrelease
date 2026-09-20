import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReusableDraftRelease } from '../scripts/select-draft-release.mjs';

const target = { tag: 'br-maps-v2026.09.1', name: 'Mapas Brasil 2026.09.1' };

test('selects draft by intended tag', () => {
  const releases = [{ id: 1, draft: true, tag_name: target.tag, name: 'old name' }];
  assert.equal(selectReusableDraftRelease(releases, target).id, 1);
});

test('selects GitHub untagged draft by deterministic release name', () => {
  const releases = [{ id: 2, draft: true, tag_name: 'untagged-c783c5bb391962d2a20d', name: target.name }];
  assert.equal(selectReusableDraftRelease(releases, target).id, 2);
});

test('never reuses a published release and fails closed on ambiguous drafts', () => {
  assert.equal(selectReusableDraftRelease([{ id: 3, draft: false, tag_name: target.tag, name: target.name }], target), null);
  assert.throws(() => selectReusableDraftRelease([
    { id: 4, draft: true, tag_name: target.tag, name: target.name },
    { id: 5, draft: true, tag_name: 'untagged-x', name: target.name }
  ], target), /ambiguous draft releases/);
});
