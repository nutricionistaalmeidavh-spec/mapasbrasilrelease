import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractPlan } from '../scripts/build-extract-plan.mjs';

test('P1 extract plan derives Brasil base and Sao Paulo from catalog', async () => {
  const plan = await buildExtractPlan(['brasil-base','sp']);
  assert.deepEqual(plan.map((x) => x.id), ['brasil-base','sp']);
  assert.deepEqual(plan[0], {id:'brasil-base', asset:'brasil-base.pmtiles', bbox:'-74,-33.8,-34.7,5.3', minZoom:0, maxZoom:7});
  assert.deepEqual(plan[1], {id:'sp', asset:'sp.pmtiles', bbox:'-53.2,-25.4,-44.1,-19.7', minZoom:7, maxZoom:14});
});

test('extract plan rejects unknown IDs and duplicates', async () => {
  await assert.rejects(() => buildExtractPlan(['sp','xx']), /unknown catalog id/);
  await assert.rejects(() => buildExtractPlan(['sp','sp']), /duplicate id/);
});
