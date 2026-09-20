# Map Distribution P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `mapasbrasilrelease` from an empty distribution repository into a validated, versioned, zero-cost catalog and release-verification system for Brazilian offline PMTiles packages, without generating real map binaries yet.

**Architecture:** Keep tracked Git content small and deterministic: a geographic catalog, a schema-versioned consumer manifest, Node.js validation/checksum/release tools, tests, documentation, and CI. Large `.pmtiles` and raw OSM extracts never enter Git; later they are attached only to GitHub Releases. The consumer contract is fail-closed and uses the latest published release manifest; draft releases are validated before publication.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, `Ajv` 8 for JSON Schema validation, GitHub Actions, GitHub Releases, SHA-256.

**Spec:** `docs/superpowers/specs/2026-09-20-map-distribution-architecture-design.md`

## Global Constraints

- Mandatory infrastructure cost must remain R$ 0.
- No ArtiSys-owned application server is required for distribution.
- The repository remains public so release assets are publicly downloadable.
- Large map binaries belong only in GitHub Releases, never in regular Git commits.
- The consumer must be able to validate a download without trusting transport alone.
- The manifest contract must be versioned and backwards-conscious.
- OpenStreetMap attribution must remain visible in consumer products that render OSM-derived data.
- Data sources and transformation provenance must be documented.
- The generation pipeline must be reproducible outside GitHub Actions.
- A failed or interrupted package build must never publish a manifest that claims the package is available.
- P0 does not generate `brasil-base.pmtiles` or any state PMTiles package.
- Node.js 22 is the supported runtime for repository tooling and CI.

## Review Focus

1. **Manifest says an asset is available but metadata is incomplete:** validation must fail before release publication.
2. **A malicious or malformed asset filename contains `/`, `\\`, or `..`:** validation must reject it rather than allowing path traversal.
3. **A release file has the expected name but wrong bytes:** release verification must reject a SHA-256 mismatch.
4. **The catalog and manifest drift apart:** validation must fail if any of the 28 geographic IDs is missing, duplicated, or unknown.
5. **A GitHub Release is still a draft:** consumers must not use it; documentation and release flow must make the latest published release the only consumer source.

---

## File Structure

Files created or modified by this plan:

```text
README.md
.gitignore
package.json
package-lock.json
LICENSE-DATA.md
NOTICE.md
catalog/
  states.json
  build-metadata.json
  maps-manifest.json
  maps-manifest.schema.json
scripts/
  lib/
    catalog.mjs
    manifest.mjs
    sha256.mjs
  validate-manifest.mjs
  checksum.mjs
  build-manifest.mjs
  verify-release.mjs
tests/
  catalog.test.mjs
  manifest.test.mjs
  checksum.test.mjs
  build-manifest.test.mjs
  verify-release.test.mjs
  fixtures/
    checksum-sample.txt
docs/
  FORMAT.md
  RELEASES.md
  SOURCES.md
.github/
  workflows/
    validate.yml
    release-check.yml
```

Responsibilities are intentionally separated:

- `catalog/states.json`: stable geographic identities and default map metadata.
- `catalog/build-metadata.json`: release-specific verified package metadata; initially empty.
- `catalog/maps-manifest.json`: generated consumer-facing snapshot.
- `catalog/maps-manifest.schema.json`: structural contract for schema v1.
- `scripts/lib/catalog.mjs`: catalog loading and stable ID expectations.
- `scripts/lib/manifest.mjs`: schema + semantic validation.
- `scripts/lib/sha256.mjs`: reusable file hashing.
- CLI scripts: thin wrappers around reusable library functions.
- tests: deterministic fixtures only; no real PMTiles.

---

### Task 1: Bootstrap the Node repository and protect Git from map binaries

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: repository scripts `npm test`, `npm run validate`, `npm run manifest:build`, `npm run release:verify`.
- Produces: Node 22 ESM environment used by all later tasks.

- [ ] **Step 1: Write the package manifest**

Create `package.json` exactly with the following intent and script surface:

```json
{
  "name": "artisys-mapas-brasil-release",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22 <23"
  },
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate-manifest.mjs",
    "manifest:build": "node scripts/build-manifest.mjs",
    "checksum": "node scripts/checksum.mjs",
    "release:verify": "node scripts/verify-release.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.1"
  }
}
```

- [ ] **Step 2: Install dependencies and create the lockfile**

Run:

```bash
npm install
```

Expected:
- exit code `0`;
- `package-lock.json` created;
- `ajv` resolved under `node_modules`.

- [ ] **Step 3: Protect generated and large geographic files**

Create `.gitignore`:

```gitignore
node_modules/
.DS_Store
*.pmtiles
*.osm.pbf
*.mbtiles
*.sqlite
*.sqlite3
release-staging/
build/
dist/
tmp/
.cache/
```

- [ ] **Step 4: Verify ignored binary classes**

Run:

```bash
git check-ignore -v sample.pmtiles sample.osm.pbf sample.mbtiles release-staging/test.pmtiles
```

Expected: every path is matched by `.gitignore`.

- [ ] **Step 5: Run baseline tests**

Run:

```bash
npm test
```

Expected: exit code `0` with zero tests discovered at this bootstrap point.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: bootstrap map distribution tooling"
```

---

### Task 2: Create the authoritative Brazil geographic catalog

**Files:**
- Create: `catalog/states.json`
- Create: `scripts/lib/catalog.mjs`
- Create: `tests/catalog.test.mjs`

**Interfaces:**
- Produces: `loadCatalog(path?) -> Promise<Array<MapCatalogEntry>>`.
- Produces: `EXPECTED_IDS`, an immutable ordered array of the 28 supported package IDs.
- `MapCatalogEntry` shape: `{ id, name, kind, minZoom, maxZoom, bounds }`.

- [ ] **Step 1: Write the failing catalog contract test**

Create `tests/catalog.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, EXPECTED_IDS } from '../scripts/lib/catalog.mjs';

test('catalog contains brasil-base plus all 26 states and DF exactly once', async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.length, 28);
  assert.deepEqual(catalog.map((entry) => entry.id), EXPECTED_IDS);
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 28);
});

test('catalog entries expose safe zooms and ordered finite bounds', async () => {
  const catalog = await loadCatalog();
  for (const entry of catalog) {
    assert.ok(Number.isInteger(entry.minZoom));
    assert.ok(Number.isInteger(entry.maxZoom));
    assert.ok(entry.minZoom <= entry.maxZoom);
    assert.equal(entry.bounds.length, 4);
    const [west, south, east, north] = entry.bounds;
    assert.ok([west, south, east, north].every(Number.isFinite));
    assert.ok(west < east);
    assert.ok(south < north);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm the gap**

Run:

```bash
node --test tests/catalog.test.mjs
```

Expected: FAIL because `scripts/lib/catalog.mjs` does not exist.

- [ ] **Step 3: Create stable catalog loader and IDs**

Create `scripts/lib/catalog.mjs`:

```js
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
```

- [ ] **Step 4: Create the 28-entry geographic catalog**

Create `catalog/states.json` with entries in exactly the `EXPECTED_IDS` order. Use these names and kinds:

```text
brasil-base = Brasil (kind national)
ac = Acre
al = Alagoas
ap = Amapá
am = Amazonas
ba = Bahia
ce = Ceará
df = Distrito Federal
es = Espírito Santo
go = Goiás
ma = Maranhão
mt = Mato Grosso
ms = Mato Grosso do Sul
mg = Minas Gerais
pa = Pará
pb = Paraíba
pr = Paraná
pe = Pernambuco
pi = Piauí
rj = Rio de Janeiro
rn = Rio Grande do Norte
rs = Rio Grande do Sul
ro = Rondônia
rr = Roraima
sc = Santa Catarina
sp = São Paulo
se = Sergipe
to = Tocantins
```

Use `minZoom: 0, maxZoom: 7` for `brasil-base`, and `minZoom: 7, maxZoom: 14` for state/DF entries. Bounds must be conservative geographic envelopes that contain the entire corresponding unit; P0 tests assert ordering and finiteness, not cadastral precision. Record the provenance/precision limitation in `docs/SOURCES.md` in Task 7 so later PMTiles generation may refine them against the exact source extract.

- [ ] **Step 5: Run the catalog tests**

Run:

```bash
node --test tests/catalog.test.mjs
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add catalog/states.json scripts/lib/catalog.mjs tests/catalog.test.mjs
git commit -m "feat: add authoritative Brazil map catalog"
```

---

### Task 3: Encode schema v1 and fail-closed manifest validation

**Files:**
- Create: `catalog/maps-manifest.schema.json`
- Create: `catalog/maps-manifest.json`
- Create: `scripts/lib/manifest.mjs`
- Create: `scripts/validate-manifest.mjs`
- Create: `tests/manifest.test.mjs`

**Interfaces:**
- Consumes: `loadCatalog()` and `EXPECTED_IDS` from Task 2.
- Produces: `validateManifest(manifest, catalog) -> { valid: boolean, errors: string[] }`.
- Produces CLI: `node scripts/validate-manifest.mjs [manifestPath] [catalogPath]` with exit `0` when valid and `1` when invalid.

- [ ] **Step 1: Write negative-first manifest tests**

Create `tests/manifest.test.mjs` that loads the checked-in manifest, asserts it passes, then deep-clones it for each negative case. Include these exact behaviors:

```js
test('initial manifest validates with all 28 packages unavailable', ...);
test('missing catalog ID fails validation', ...);
test('duplicate geographic ID fails validation', ...);
test('unknown geographic ID fails validation', ...);
test('available entry requires version asset size sha256 and sourceDate', ...);
test('unavailable entry rejects release-specific metadata', ...);
test('asset path separators and dot-dot are rejected', ...);
test('sha256 must be 64 lowercase hexadecimal characters', ...);
test('size must be a positive integer when available', ...);
test('invalid zoom range fails validation', ...);
test('invalid bounds order fails validation', ...);
test('releaseVersion must match YYYY.MM.PATCH', ...);
```

For the path traversal review-focus test, mutate `sp.asset` to each of:

```js
['../sp.pmtiles', 'maps/sp.pmtiles', 'maps\\sp.pmtiles']
```

and assert every variant fails.

- [ ] **Step 2: Run the focused test and confirm the gap**

Run:

```bash
node --test tests/manifest.test.mjs
```

Expected: FAIL because validator/schema/manifest do not yet exist.

- [ ] **Step 3: Create JSON Schema v1**

Create `catalog/maps-manifest.schema.json` with:

- Draft 2020-12 schema declaration;
- top-level `additionalProperties: false`;
- required top-level keys `schemaVersion`, `releaseVersion`, `generatedAt`, `source`, `maps`;
- `schemaVersion` constant `1`;
- `releaseVersion` pattern `^[0-9]{4}\\.[0-9]{2}\\.[0-9]+$`;
- `generatedAt` as a string with `date-time` format only if format support is configured; otherwise enforce a strict UTC ISO regex in schema and semantic validation;
- `source.provider` constant `OpenStreetMap`;
- `source.license` constant `ODbL-1.0`;
- each map entry with `additionalProperties: false`;
- `kind` enum `national|state|federal-district`;
- `available` boolean;
- `version`, `asset`, `size`, `sha256`, `sourceDate` allowing null for unavailable entries;
- `minZoom`/`maxZoom` integers in `[0, 22]`;
- `bounds` fixed-length array of four numbers.

Do not encode catalog-completeness or availability cross-field rules only in JSON Schema; those belong to semantic validation so error messages remain explicit.

- [ ] **Step 4: Implement structural and semantic validation**

Create `scripts/lib/manifest.mjs` using Ajv and explicit semantic checks.

Required semantic algorithm:

```js
export async function validateManifest(manifest, catalog) {
  const errors = [];
  // 1. Ajv schema validation.
  // 2. Require exactly the same set of IDs as catalog.
  // 3. Reject duplicates and unknown IDs.
  // 4. Enforce deterministic asset name: brasil-base.pmtiles or <id>.pmtiles.
  // 5. available=true => version/asset/size/sha256/sourceDate all present and valid.
  // 6. available=false => version/asset/size/sha256/sourceDate all null.
  // 7. asset must be basename only: no '/', '\\', or '..'.
  // 8. sha256 regex /^[0-9a-f]{64}$/.
  // 9. size integer > 0 when available.
  // 10. minZoom <= maxZoom.
  // 11. west < east and south < north.
  // 12. map name/kind/zoom/bounds must match the stable catalog entry.
  return { valid: errors.length === 0, errors };
}
```

Ajv errors must be normalized to readable strings rather than dumped as opaque objects.

- [ ] **Step 5: Create the initial consumer manifest**

Create `catalog/maps-manifest.json` with:

```json
{
  "schemaVersion": 1,
  "releaseVersion": "2026.09.0",
  "generatedAt": "2026-09-20T00:00:00Z",
  "source": {
    "provider": "OpenStreetMap",
    "license": "ODbL-1.0"
  },
  "maps": []
}
```

Populate `maps` from all 28 catalog entries. Every initial entry must have:

```json
{
  "available": false,
  "version": null,
  "asset": null,
  "size": null,
  "sha256": null,
  "sourceDate": null
}
```

and the stable `id`, `name`, `kind`, `minZoom`, `maxZoom`, `bounds` copied from `states.json`.

- [ ] **Step 6: Create CLI validation wrapper**

Create `scripts/validate-manifest.mjs` that:

1. accepts optional manifest and catalog paths;
2. defaults to checked-in catalog files;
3. prints `Manifest valid: <path>` on success;
4. prints each validation error to stderr on failure;
5. sets `process.exitCode = 1` on failure.

- [ ] **Step 7: Run focused and CLI checks**

Run:

```bash
node --test tests/manifest.test.mjs
npm run validate
```

Expected:
- manifest suite PASS;
- CLI prints a valid-manifest message;
- both commands exit `0`.

- [ ] **Step 8: Commit**

```bash
git add catalog/maps-manifest.schema.json catalog/maps-manifest.json scripts/lib/manifest.mjs scripts/validate-manifest.mjs tests/manifest.test.mjs
git commit -m "feat: add fail-closed manifest contract validation"
```

---

### Task 4: Build manifests deterministically from verified build metadata

**Files:**
- Create: `catalog/build-metadata.json`
- Create: `scripts/build-manifest.mjs`
- Create: `tests/build-manifest.test.mjs`

**Interfaces:**
- Consumes: geographic catalog from Task 2.
- Consumes metadata array entries shaped as `{ id, version, sourceDate, size, sha256, minZoom, maxZoom }`.
- Produces: deterministic manifest JSON with availability driven only by metadata entries.

- [ ] **Step 1: Write failing build tests**

Create `tests/build-manifest.test.mjs` covering:

```js
test('empty build metadata produces all 28 entries unavailable', ...);
test('verified metadata for sp produces only sp as available', ...);
test('metadata for unknown catalog ID fails', ...);
test('duplicate metadata IDs fail', ...);
test('incomplete available metadata fails instead of publishing a partial entry', ...);
```

Use a temporary output file under `os.tmpdir()`; never mutate the checked-in manifest during tests.

- [ ] **Step 2: Run the focused test and confirm the gap**

Run:

```bash
node --test tests/build-manifest.test.mjs
```

Expected: FAIL because `scripts/build-manifest.mjs` does not exist.

- [ ] **Step 3: Create initial empty build metadata**

Create `catalog/build-metadata.json`:

```json
[]
```

- [ ] **Step 4: Implement deterministic manifest builder**

`scripts/build-manifest.mjs` must export a reusable function:

```js
export async function buildManifest({ catalogPath, metadataPath, outputPath, releaseVersion, generatedAt }) { ... }
```

Rules:

- catalog order controls output order;
- absent metadata => unavailable entry with all release fields null;
- present metadata => available entry only after all fields validate;
- asset name is derived, never supplied: `brasil-base.pmtiles` or `<id>.pmtiles`;
- unknown or duplicate metadata IDs throw;
- generated output is validated using `validateManifest()` before writing;
- write to `<output>.tmp` first, then rename atomically;
- deterministic JSON formatting is two spaces + trailing newline.

CLI arguments:

```text
--metadata <path>
--output <path>
--release-version <YYYY.MM.PATCH>
--generated-at <UTC ISO timestamp>
```

Defaults may target checked-in files except `generated-at`, which must be supplied explicitly in CI/release automation to keep builds reproducible.

- [ ] **Step 5: Prove initial checked-in manifest can be regenerated**

Run:

```bash
node scripts/build-manifest.mjs \
  --metadata catalog/build-metadata.json \
  --output /tmp/maps-manifest.json \
  --release-version 2026.09.0 \
  --generated-at 2026-09-20T00:00:00Z
```

On Windows PowerShell use `$env:TEMP` instead of `/tmp`.

Expected: generated file validates and contains all 28 entries unavailable.

- [ ] **Step 6: Run focused tests**

```bash
node --test tests/build-manifest.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add catalog/build-metadata.json scripts/build-manifest.mjs tests/build-manifest.test.mjs
git commit -m "feat: add deterministic manifest builder"
```

---

### Task 5: Add SHA-256 tooling with deterministic fixture coverage

**Files:**
- Create: `scripts/lib/sha256.mjs`
- Create: `scripts/checksum.mjs`
- Create: `tests/checksum.test.mjs`
- Create: `tests/fixtures/checksum-sample.txt`

**Interfaces:**
- Produces: `sha256File(path) -> Promise<string>` lowercase 64-char digest.
- CLI: `node scripts/checksum.mjs <file> [file...]`, output `<sha256>  <basename>`.

- [ ] **Step 1: Create a fixed fixture and failing test**

Create `tests/fixtures/checksum-sample.txt` containing exactly:

```text
ArtiSys Mapas Brasil
```

with a final newline.

Create `tests/checksum.test.mjs` that independently computes the expected digest using `createHash('sha256').update(Buffer.from('ArtiSys Mapas Brasil\n')).digest('hex')` and compares it with `sha256File()`.

Also assert:

```js
assert.match(actual, /^[0-9a-f]{64}$/);
```

- [ ] **Step 2: Run the focused test and confirm the gap**

```bash
node --test tests/checksum.test.mjs
```

Expected: FAIL because `scripts/lib/sha256.mjs` is missing.

- [ ] **Step 3: Implement streamed SHA-256 calculation**

Create `scripts/lib/sha256.mjs` using `createReadStream()` piped into a `createHash('sha256')` instance; do not read large map files fully into memory.

Export:

```js
export function sha256File(path) {
  return new Promise((resolve, reject) => { ... });
}
```

- [ ] **Step 4: Create checksum CLI**

`scripts/checksum.mjs` must:

- require at least one path;
- hash paths sequentially by default to avoid unnecessary disk contention;
- print lowercase SHA-256 and basename;
- exit non-zero when any file cannot be read.

- [ ] **Step 5: Run focused and CLI checks**

```bash
node --test tests/checksum.test.mjs
node scripts/checksum.mjs tests/fixtures/checksum-sample.txt
```

Expected: PASS and one 64-character digest line.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/sha256.mjs scripts/checksum.mjs tests/checksum.test.mjs tests/fixtures/checksum-sample.txt
git commit -m "feat: add streaming SHA-256 tooling"
```

---

### Task 6: Verify staged release assets against manifest metadata

**Files:**
- Create: `scripts/verify-release.mjs`
- Create: `tests/verify-release.test.mjs`

**Interfaces:**
- Consumes: validated manifest and a local asset directory.
- Produces: `verifyRelease({ manifestPath, assetsDir }) -> Promise<{ valid, errors }>`.
- CLI: `node scripts/verify-release.mjs --manifest <path> --assets <dir>`.

- [ ] **Step 1: Write failing release-verification tests**

Use `mkdtemp()` under the OS temp directory and synthesize a manifest entry for `sp` whose size and SHA-256 match a small fixture copied to `sp.pmtiles`.

Required tests:

```js
test('release with no available packages validates against an empty directory', ...);
test('available asset with matching size and sha256 passes', ...);
test('missing declared asset fails', ...);
test('same filename with wrong bytes fails sha256 verification', ...);
test('same digest expectation with wrong byte size fails', ...);
test('undeclared pmtiles asset is rejected', ...);
test('path-like asset name is rejected before filesystem access', ...);
```

The wrong-bytes test directly covers Review Focus item 3.

- [ ] **Step 2: Run the focused test and confirm the gap**

```bash
node --test tests/verify-release.test.mjs
```

Expected: FAIL because verifier does not exist.

- [ ] **Step 3: Implement local release verifier**

`verifyRelease()` must:

1. validate the manifest first;
2. enumerate only regular files in `assetsDir`;
3. build the expected set from `available: true` entries plus `maps-manifest.json` and `SHA256SUMS.txt` only when the caller has staged those metadata files;
4. reject undeclared `.pmtiles` files;
5. for each available map asset, require exact basename, exact byte size, and exact SHA-256;
6. return all discovered errors, not only the first;
7. never execute or parse PMTiles content in P0.

For an all-unavailable manifest, an empty directory must be valid.

- [ ] **Step 4: Implement CLI argument parsing**

Required invocation:

```bash
node scripts/verify-release.mjs --manifest catalog/maps-manifest.json --assets release-staging
```

Missing arguments or invalid directories exit non-zero with readable stderr.

- [ ] **Step 5: Run focused tests**

```bash
node --test tests/verify-release.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-release.mjs tests/verify-release.test.mjs
git commit -m "feat: verify staged map release assets"
```

---

### Task 7: Document provenance, release flow, format, and OSM attribution

**Files:**
- Modify: `README.md`
- Create: `LICENSE-DATA.md`
- Create: `NOTICE.md`
- Create: `docs/FORMAT.md`
- Create: `docs/RELEASES.md`
- Create: `docs/SOURCES.md`

**Interfaces:**
- Produces: human-readable contract for maintainers and consumer developers.
- Produces: explicit rule that consumer apps use only the latest **published** release, never a draft/prerelease/branch manifest.

- [ ] **Step 1: Replace the placeholder README**

`README.md` must explain:

- this repository distributes offline Brazilian map packages for ArtiSys products;
- P0 contains no real `.pmtiles` assets yet;
- tracked Git source vs GitHub Release assets;
- Node 22 setup;
- commands:
  - `npm install`
  - `npm test`
  - `npm run validate`
  - `npm run manifest:build -- ...`
  - `npm run checksum -- ...`
  - `npm run release:verify -- ...`;
- link to `docs/FORMAT.md`, `docs/RELEASES.md`, `docs/SOURCES.md`;
- zero-cost/no-ArtiSys-server design constraint.

- [ ] **Step 2: Add data-license notice**

`LICENSE-DATA.md` must distinguish repository source code from map data and state that OSM-derived distributed data remains subject to ODbL 1.0 obligations. It must link maintainers to the canonical OpenStreetMap copyright/license page rather than copying the full ODbL license text into this repository.

- [ ] **Step 3: Add consumer attribution notice**

`NOTICE.md` must contain the exact consumer-facing attribution text:

```text
© OpenStreetMap contributors
https://www.openstreetmap.org/copyright
```

and state that consumer applications must keep attribution visible whenever OSM-derived map data is rendered.

- [ ] **Step 4: Document manifest and asset format**

`docs/FORMAT.md` must document:

- schema v1 top-level keys;
- map-entry fields and nullability;
- deterministic asset naming;
- SHA-256 requirement;
- size in bytes;
- zoom/bounds semantics;
- the 28 supported IDs;
- consumer behavior for unknown future schema versions: fail closed and prompt for app update rather than guessing.

- [ ] **Step 5: Document draft-to-published release flow**

`docs/RELEASES.md` must define exactly this lifecycle:

```text
1. Generate/stage candidate files locally or on Woodpecker.
2. Compute byte sizes and SHA-256.
3. Build manifest from verified metadata.
4. Create GitHub Release as DRAFT with tag br-maps-vYYYY.MM.PATCH.
5. Upload PMTiles + maps-manifest.json + SHA256SUMS.txt to the draft.
6. Run release-check against the draft assets.
7. If verification fails, keep the release draft and replace/fix assets.
8. Only after verification passes, publish the release.
9. ArtiSys consumers discover only the latest published non-prerelease release.
```

Also document rollback: do not delete the previous valid published release when publishing a new one.

- [ ] **Step 6: Document source provenance and bounding-box limitation**

`docs/SOURCES.md` must state:

- primary intended source is OpenStreetMap-derived extracts from an openly redistributable extract provider;
- exact provider, extract timestamp, and transformation tool versions must be recorded when real packages are generated in P1;
- P0 state bounds are conservative catalog envelopes used for discovery/display, not cadastral/legal boundaries;
- exact generated package extents must be measured from the production source pipeline;
- no endorsement by OpenStreetMap contributors is implied.

- [ ] **Step 7: Run repository tests and validation after documentation changes**

```bash
npm test
npm run validate
```

Expected: both commands exit `0`.

- [ ] **Step 8: Commit**

```bash
git add README.md LICENSE-DATA.md NOTICE.md docs/FORMAT.md docs/RELEASES.md docs/SOURCES.md
git commit -m "docs: document map format releases and attribution"
```

---

### Task 8: Add GitHub Actions validation and draft-release verification

**Files:**
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/release-check.yml`

**Interfaces:**
- `validate.yml`: source/contract CI on push and pull request.
- `release-check.yml`: manually verifies one existing GitHub draft release by tag before a human publishes it.

- [ ] **Step 1: Add source validation workflow**

Create `.github/workflows/validate.yml`:

```yaml
name: Validate map catalog

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run validate
```

- [ ] **Step 2: Add manual draft-release verification workflow**

Create `.github/workflows/release-check.yml` with `workflow_dispatch` input `release_tag` and `permissions: contents: read`.

Core steps:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- name: Download draft release assets
  env:
    GH_TOKEN: ${{ github.token }}
    RELEASE_TAG: ${{ inputs.release_tag }}
  run: |
    mkdir -p release-staging
    gh release download "$RELEASE_TAG" --dir release-staging
- name: Require release manifest
  run: test -f release-staging/maps-manifest.json
- name: Validate release manifest
  run: node scripts/validate-manifest.mjs release-staging/maps-manifest.json catalog/states.json
- name: Verify release assets
  run: node scripts/verify-release.mjs --manifest release-staging/maps-manifest.json --assets release-staging
```

Add a shell step that verifies `SHA256SUMS.txt` is present whenever at least one `.pmtiles` asset exists. The verifier remains authoritative for manifest-declared PMTiles metadata.

Do **not** add any step that publishes a draft release automatically in P0. Publication remains an explicit maintainer action after the workflow is green.

- [ ] **Step 3: Validate workflow YAML structure without introducing another dependency**

Inspect both workflow files and run repository tests locally:

```bash
npm test
npm run validate
```

Expected: all local checks PASS. GitHub syntax/runtime validation is completed by the PR workflow after push.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/validate.yml .github/workflows/release-check.yml
git commit -m "ci: validate catalog and draft map releases"
```

---

### Task 9: Integrated P0 verification and PR readiness

**Files:**
- No planned production changes. Fix only P0 defects revealed by verification, with a focused regression test before each fix.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: fresh evidence that P0 meets the approved spec.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: exit `0`; all catalog, manifest, builder, checksum, and release-verifier tests PASS.

- [ ] **Step 2: Validate the checked-in manifest**

```bash
npm run validate
```

Expected: exit `0`; reports the manifest valid.

- [ ] **Step 3: Regenerate the initial manifest into a temporary file and compare semantically**

```bash
node scripts/build-manifest.mjs \
  --metadata catalog/build-metadata.json \
  --output ./tmp/maps-manifest.generated.json \
  --release-version 2026.09.0 \
  --generated-at 2026-09-20T00:00:00Z
```

Then compare the generated JSON object with `catalog/maps-manifest.json`; expected semantic equality.

- [ ] **Step 4: Verify all-unavailable release staging**

```bash
mkdir -p release-staging
node scripts/verify-release.mjs --manifest catalog/maps-manifest.json --assets release-staging
```

Expected: exit `0` because P0 declares no available PMTiles assets.

- [ ] **Step 5: Prove Git refuses the forbidden artifact classes**

```bash
git check-ignore -v x.pmtiles x.osm.pbf x.mbtiles release-staging/x.pmtiles
```

Expected: every sample path is ignored.

- [ ] **Step 6: Inspect the branch diff for scope and secrets**

Run:

```bash
git status --short
git diff main...HEAD --stat
git diff main...HEAD -- . ':!package-lock.json'
```

Verify:

- no `.pmtiles`, `.osm.pbf`, `.mbtiles`, secrets, tokens, or generated archives are tracked;
- only approved P0 files changed;
- README/spec/plan accurately describe current behavior;
- there is no automatic release publication step.

- [ ] **Step 7: Push/update PR and inspect GitHub Actions**

After the branch is pushed, wait for `Validate map catalog` on the PR and inspect its actual run result. A green local run without a green PR workflow is not sufficient to call CI configured correctly.

- [ ] **Step 8: Perform independent code-verification review**

Use `codex-engineering-guardrails:code-verification` read-only against `main...HEAD` with this traceability matrix:

```text
28-package catalog -> catalog tests + manifest completeness tests
fail-closed manifest -> negative manifest tests + npm run validate
streaming integrity -> checksum test
release byte/sha verification -> verify-release negative tests
no binaries in Git -> .gitignore + git check-ignore + diff inspection
published-release-only contract -> docs/RELEASES.md inspection
CI validation -> fresh PR Actions result
```

Verdict must be Pass/Partial/Fail/Inconclusive based on fresh evidence.

- [ ] **Step 9: Mark PR ready only if verification is clean**

If and only if:

- local tests PASS;
- checked-in manifest validates;
- PR workflow is green;
- independent verification finds no material P0 defect;

then mark the PR ready for review. Do not merge automatically unless the user separately authorizes the merge.
