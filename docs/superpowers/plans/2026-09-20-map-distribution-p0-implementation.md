# Map Distribution P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `mapasbrasilrelease` into a validated, versioned, zero-cost catalog and release-verification system for Brazilian offline PMTiles packages, without generating real map binaries yet.

**Architecture:** Keep tracked Git content small and deterministic: a geographic catalog, schema-versioned consumer manifest, Node.js validation/checksum/release tools, tests, documentation, and CI. Large `.pmtiles` and raw OSM extracts never enter Git; later they are attached only to GitHub Releases. The contract is fail-closed and consumers use only the latest published non-prerelease release.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, Ajv 8, GitHub Actions, GitHub Releases, SHA-256.

**Spec:** `docs/superpowers/specs/2026-09-20-map-distribution-architecture-design.md`

## Global Constraints

- Mandatory infrastructure cost must remain R$ 0.
- No ArtiSys-owned application server is required.
- Repository remains public.
- `.pmtiles`, `.osm.pbf`, `.mbtiles`, generated tile databases and build directories must never enter Git history.
- Every available package requires exact byte size and SHA-256.
- Schema contract starts at `schemaVersion: 1`.
- OpenStreetMap attribution and source provenance must be documented.
- Generation must remain reproducible from a local workstation or Woodpecker worker.
- A failed or interrupted build must never produce a published manifest entry with `available: true`.
- P0 does not generate real PMTiles packages.
- Node.js 22 is the supported runtime.

## Review Focus

1. Incomplete `available: true` metadata must fail validation.
2. Asset names containing `/`, `\\`, or `..` must fail before filesystem access.
3. Same filename with wrong bytes must fail SHA-256 verification.
4. Catalog/manifest drift must fail when an ID is missing, duplicated, or unknown.
5. Draft/prerelease releases must never be the consumer source.

---

## File Structure

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
.github/workflows/
  validate.yml
  release-check.yml
```

---

### Task 1: Bootstrap Node tooling and protect Git history

**Files:** `package.json`, `package-lock.json`, `.gitignore`

**Produces:** `npm test`, `npm run validate`, `npm run manifest:build`, `npm run checksum`, `npm run release:verify`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "artisys-mapas-brasil-release",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate-manifest.mjs",
    "manifest:build": "node scripts/build-manifest.mjs",
    "checksum": "node scripts/checksum.mjs",
    "release:verify": "node scripts/verify-release.mjs"
  },
  "devDependencies": { "ajv": "^8.17.1" }
}
```

- [ ] **Step 2: Create the lockfile**

```bash
npm install
```

Expected: exit `0`, `package-lock.json` created.

- [ ] **Step 3: Create `.gitignore`**

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

- [ ] **Step 4: Verify ignore rules**

```bash
git check-ignore -v sample.pmtiles sample.osm.pbf sample.mbtiles release-staging/test.pmtiles
```

Expected: all four paths matched.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: bootstrap map distribution tooling"
```

---

### Task 2: Create the authoritative 28-package Brazil catalog

**Files:** `catalog/states.json`, `scripts/lib/catalog.mjs`, `tests/catalog.test.mjs`

**Produces:** `loadCatalog(path?)`, `EXPECTED_IDS`.

- [ ] **Step 1: Write failing catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, EXPECTED_IDS } from '../scripts/lib/catalog.mjs';

test('catalog contains brasil-base plus 26 states and DF exactly once', async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.length, 28);
  assert.deepEqual(catalog.map((entry) => entry.id), EXPECTED_IDS);
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 28);
});

test('catalog zooms and bounds are structurally safe', async () => {
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

Run before implementation:

```bash
node --test tests/catalog.test.mjs
```

Expected: FAIL because the loader does not exist.

- [ ] **Step 2: Implement catalog loader**

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

- [ ] **Step 3: Create `catalog/states.json`**

Use exactly these IDs/names/kinds:

```text
brasil-base Brasil national
ac Acre state
al Alagoas state
ap Amapá state
am Amazonas state
ba Bahia state
ce Ceará state
df Distrito Federal federal-district
es Espírito Santo state
go Goiás state
ma Maranhão state
mt Mato Grosso state
ms Mato Grosso do Sul state
mg Minas Gerais state
pa Pará state
pb Paraíba state
pr Paraná state
pe Pernambuco state
pi Piauí state
rj Rio de Janeiro state
rn Rio Grande do Norte state
rs Rio Grande do Sul state
ro Rondônia state
rr Roraima state
sc Santa Catarina state
sp São Paulo state
se Sergipe state
to Tocantins state
```

Each entry shape:

```json
{
  "id": "sp",
  "name": "São Paulo",
  "kind": "state",
  "minZoom": 7,
  "maxZoom": 14,
  "bounds": [-53.2, -25.4, -44.1, -19.7]
}
```

Use `minZoom: 0`, `maxZoom: 7` for `brasil-base`, otherwise `7` and `14`. Bounds must conservatively contain each unit; they are discovery/display envelopes, not legal boundaries. `docs/SOURCES.md` must say that production extents will be refined from the actual source extract in P1.

- [ ] **Step 4: Run test and commit**

```bash
node --test tests/catalog.test.mjs
git add catalog/states.json scripts/lib/catalog.mjs tests/catalog.test.mjs
git commit -m "feat: add authoritative Brazil map catalog"
```

Expected: 2 tests PASS.

---

### Task 3: Add schema v1 and fail-closed manifest validation

**Files:** `catalog/maps-manifest.schema.json`, `catalog/maps-manifest.json`, `scripts/lib/manifest.mjs`, `scripts/validate-manifest.mjs`, `tests/manifest.test.mjs`

**Produces:** `validateManifest(manifest, catalog) -> { valid, errors }`.

- [ ] **Step 1: Write manifest test harness and negative cases**

Use this concrete helper pattern:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManifest } from '../scripts/lib/manifest.mjs';
import { loadCatalog } from '../scripts/lib/catalog.mjs';

const clone = (value) => structuredClone(value);
const find = (manifest, id) => manifest.maps.find((entry) => entry.id === id);

async function fixtures() {
  return {
    manifest: JSON.parse(await readFile(new URL('../catalog/maps-manifest.json', import.meta.url), 'utf8')),
    catalog: await loadCatalog()
  };
}

async function expectInvalid(mutator) {
  const { manifest, catalog } = await fixtures();
  const candidate = clone(manifest);
  mutator(candidate);
  const result = await validateManifest(candidate, catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
}
```

Create tests with these exact mutations:

| Test | Mutation |
|---|---|
| valid initial manifest | none; expect `valid === true`, 28 entries, all unavailable |
| missing ID | remove `sp` from `maps` |
| duplicate ID | push a clone of `sp` |
| unknown ID | change `sp.id` to `xx` |
| incomplete available | set `sp.available=true`, leave release fields null |
| unavailable with metadata | set `sp.version='2026.09.0'` while unavailable |
| traversal | make `sp` fully available, then test `../sp.pmtiles`, `maps/sp.pmtiles`, `maps\\sp.pmtiles` |
| bad digest | fully available `sp`, set `sha256='ABC'` |
| bad size | fully available `sp`, set `size=0` |
| bad zoom | set `sp.minZoom=15`, `sp.maxZoom=14` |
| bad bounds | set `sp.bounds=[-44,-20,-53,-25]` |
| bad release version | set top-level `releaseVersion='v1'` |

For a fully available synthetic `sp`, use:

```js
Object.assign(find(candidate, 'sp'), {
  available: true,
  version: '2026.09.0',
  asset: 'sp.pmtiles',
  size: 12,
  sha256: 'a'.repeat(64),
  sourceDate: '2026-09-20'
});
```

Run before implementation:

```bash
node --test tests/manifest.test.mjs
```

Expected: FAIL because schema/validator do not exist.

- [ ] **Step 2: Create JSON Schema v1**

Schema requirements:

```text
$schema = https://json-schema.org/draft/2020-12/schema
additionalProperties = false at top level and map-entry level
schemaVersion const 1
releaseVersion pattern ^[0-9]{4}\.[0-9]{2}\.[0-9]+$
generatedAt strict UTC ISO string
source.provider const OpenStreetMap
source.license const ODbL-1.0
kind enum national|state|federal-district
minZoom/maxZoom integer 0..22
bounds array exactly 4 numbers
version/asset/size/sha256/sourceDate accept null so semantic validation can enforce availability rules
```

- [ ] **Step 3: Implement semantic validation**

`validateManifest()` must perform these checks in order and accumulate readable error strings:

```text
1. Run Ajv structural validation.
2. Reject duplicate IDs.
3. Reject IDs not present in catalog.
4. Require the manifest ID set to equal the catalog ID set exactly.
5. Require name/kind/minZoom/maxZoom/bounds to match the catalog entry.
6. available=true requires non-null version, asset, size, sha256, sourceDate.
7. available=false requires those five fields to be null.
8. Derived asset name must equal brasil-base.pmtiles for brasil-base, otherwise <id>.pmtiles.
9. Asset must be a basename: reject '/', '\\', and '..'.
10. sha256 must match /^[0-9a-f]{64}$/ when available.
11. size must be an integer > 0 when available.
12. minZoom <= maxZoom.
13. bounds satisfy west < east and south < north.
```

- [ ] **Step 4: Create initial manifest**

Top level:

```json
{
  "schemaVersion": 1,
  "releaseVersion": "2026.09.0",
  "generatedAt": "2026-09-20T00:00:00Z",
  "source": { "provider": "OpenStreetMap", "license": "ODbL-1.0" },
  "maps": []
}
```

Populate all 28 entries in catalog order. Every entry starts with:

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

plus stable catalog fields.

- [ ] **Step 5: Implement CLI wrapper**

`node scripts/validate-manifest.mjs [manifestPath] [catalogPath]` must print `Manifest valid: <path>` on success; on failure print each error to stderr and set exit code `1`.

- [ ] **Step 6: Verify and commit**

```bash
node --test tests/manifest.test.mjs
npm run validate
git add catalog/maps-manifest.schema.json catalog/maps-manifest.json scripts/lib/manifest.mjs scripts/validate-manifest.mjs tests/manifest.test.mjs
git commit -m "feat: add fail-closed manifest contract validation"
```

Expected: manifest tests PASS; CLI exits `0`.

---

### Task 4: Build manifest deterministically from verified metadata

**Files:** `catalog/build-metadata.json`, `scripts/build-manifest.mjs`, `tests/build-manifest.test.mjs`

**Produces:** `buildManifest({ catalogPath, metadataPath, outputPath, releaseVersion, generatedAt })`.

- [ ] **Step 1: Write build tests using temp files**

Required cases:

```text
A. [] metadata -> 28 unavailable entries.
B. one complete sp metadata record -> only sp available and asset derived as sp.pmtiles.
C. metadata id xx -> reject.
D. two metadata records with id sp -> reject.
E. sp record missing sha256 -> reject and write no output.
```

Use this complete synthetic metadata object for case B:

```js
{
  id: 'sp',
  version: '2026.09.0',
  sourceDate: '2026-09-20',
  size: 12,
  sha256: 'a'.repeat(64),
  minZoom: 7,
  maxZoom: 14
}
```

Run before implementation:

```bash
node --test tests/build-manifest.test.mjs
```

Expected: FAIL because builder does not exist.

- [ ] **Step 2: Create `catalog/build-metadata.json`**

```json
[]
```

- [ ] **Step 3: Implement builder**

Exact behavior:

```text
read catalog -> read metadata -> reject unknown/duplicate/incomplete metadata -> map catalog in stable order -> derive unavailable/available entries -> assemble top-level object -> call validateManifest -> if invalid throw -> write JSON to <output>.tmp with 2-space indent + newline -> atomic rename to output.
```

Asset derivation is fixed:

```js
const assetFor = (id) => id === 'brasil-base' ? 'brasil-base.pmtiles' : `${id}.pmtiles`;
```

CLI flags are exactly:

```text
--metadata <path>
--output <path>
--release-version <YYYY.MM.PATCH>
--generated-at <UTC ISO timestamp>
```

`--generated-at` is mandatory so reproducible builds do not silently inject wall-clock time.

- [ ] **Step 4: Verify and commit**

Linux/macOS:

```bash
node scripts/build-manifest.mjs --metadata catalog/build-metadata.json --output /tmp/maps-manifest.json --release-version 2026.09.0 --generated-at 2026-09-20T00:00:00Z
node --test tests/build-manifest.test.mjs
```

PowerShell equivalent:

```powershell
node scripts/build-manifest.mjs --metadata catalog/build-metadata.json --output "$env:TEMP\maps-manifest.json" --release-version 2026.09.0 --generated-at 2026-09-20T00:00:00Z
node --test tests/build-manifest.test.mjs
```

Commit:

```bash
git add catalog/build-metadata.json scripts/build-manifest.mjs tests/build-manifest.test.mjs
git commit -m "feat: add deterministic manifest builder"
```

---

### Task 5: Add streaming SHA-256 tooling

**Files:** `scripts/lib/sha256.mjs`, `scripts/checksum.mjs`, `tests/checksum.test.mjs`, `tests/fixtures/checksum-sample.txt`

**Produces:** `sha256File(path) -> Promise<string>`.

- [ ] **Step 1: Create fixture and failing test**

`tests/fixtures/checksum-sample.txt` contains exactly `ArtiSys Mapas Brasil` plus final newline.

Test:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sha256File } from '../scripts/lib/sha256.mjs';

test('sha256File returns the expected lowercase digest', async () => {
  const path = fileURLToPath(new URL('./fixtures/checksum-sample.txt', import.meta.url));
  const expected = createHash('sha256').update(Buffer.from('ArtiSys Mapas Brasil\n')).digest('hex');
  const actual = await sha256File(path);
  assert.equal(actual, expected);
  assert.match(actual, /^[0-9a-f]{64}$/);
});
```

Run and expect missing-module failure:

```bash
node --test tests/checksum.test.mjs
```

- [ ] **Step 2: Implement streaming hash**

```js
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
```

- [ ] **Step 3: Implement CLI and verify**

CLI requires at least one file, hashes sequentially, prints `<digest>  <basename>`, and exits non-zero on read failure.

```bash
node --test tests/checksum.test.mjs
node scripts/checksum.mjs tests/fixtures/checksum-sample.txt
```

Commit:

```bash
git add scripts/lib/sha256.mjs scripts/checksum.mjs tests/checksum.test.mjs tests/fixtures/checksum-sample.txt
git commit -m "feat: add streaming SHA-256 tooling"
```

---

### Task 6: Verify staged release assets

**Files:** `scripts/verify-release.mjs`, `tests/verify-release.test.mjs`

**Produces:** `verifyRelease({ manifestPath, assetsDir }) -> { valid, errors }` and CLI.

- [ ] **Step 1: Write release-verification test matrix**

Tests use `mkdtemp()` and a small file named `sp.pmtiles`. The synthetic manifest entry uses the exact `stat.size` and `sha256File()` result from that temporary file.

Required cases:

```text
1. all packages unavailable + empty directory -> valid.
2. sp available + matching basename/size/digest -> valid.
3. declared sp missing -> invalid.
4. sp exists but bytes changed after digest calculation -> invalid digest.
5. sp manifest size altered by +1 -> invalid size.
6. undeclared mg.pmtiles present -> invalid.
7. manifest asset ../sp.pmtiles -> invalid before filesystem lookup.
```

Run before implementation:

```bash
node --test tests/verify-release.test.mjs
```

Expected: FAIL because verifier does not exist.

- [ ] **Step 2: Implement verifier**

Exact algorithm:

```text
load manifest -> load catalog -> validateManifest -> if invalid return those errors -> read assets directory -> consider regular files only -> reject undeclared .pmtiles -> for each available map require exact asset basename -> stat for exact byte size -> stream SHA-256 -> compare lowercase digest -> return all errors.
```

P0 never executes or parses PMTiles content.

CLI syntax:

```bash
node scripts/verify-release.mjs --manifest catalog/maps-manifest.json --assets release-staging
```

Missing arguments/non-directory paths must exit `1` with readable stderr.

- [ ] **Step 3: Verify and commit**

```bash
node --test tests/verify-release.test.mjs
git add scripts/verify-release.mjs tests/verify-release.test.mjs
git commit -m "feat: verify staged map release assets"
```

---

### Task 7: Document provenance, format, release lifecycle and attribution

**Files:** modify `README.md`; create `LICENSE-DATA.md`, `NOTICE.md`, `docs/FORMAT.md`, `docs/RELEASES.md`, `docs/SOURCES.md`

- [ ] **Step 1: Replace README**

README must state purpose, zero-cost/no-server constraint, Node 22 setup, source-vs-release separation, and these concrete commands:

```bash
npm install
npm test
npm run validate
node scripts/build-manifest.mjs --metadata catalog/build-metadata.json --output ./tmp/maps-manifest.json --release-version 2026.09.0 --generated-at 2026-09-20T00:00:00Z
npm run checksum -- tests/fixtures/checksum-sample.txt
npm run release:verify -- --manifest catalog/maps-manifest.json --assets release-staging
```

It must link `docs/FORMAT.md`, `docs/RELEASES.md`, `docs/SOURCES.md`.

- [ ] **Step 2: Add license and notice**

`LICENSE-DATA.md` distinguishes source code from OSM-derived data and references ODbL 1.0/OpenStreetMap copyright page.

`NOTICE.md` contains exactly:

```text
© OpenStreetMap contributors
https://www.openstreetmap.org/copyright
```

and requires visible attribution in consumer map views.

- [ ] **Step 3: Add format documentation**

`docs/FORMAT.md` documents schema v1 fields/nullability, 28 IDs, deterministic asset names, byte size, SHA-256, zoom/bounds, and fail-closed handling of future unknown schema versions.

- [ ] **Step 4: Add release documentation**

`docs/RELEASES.md` must define:

```text
1. Stage candidate files locally or on Woodpecker.
2. Compute size and SHA-256.
3. Build manifest from verified metadata.
4. Create GitHub Release as DRAFT tagged br-maps-vYYYY.MM.PATCH.
5. Upload PMTiles + maps-manifest.json + SHA256SUMS.txt.
6. Run release-check against draft assets.
7. Fix/replace assets while still draft if any check fails.
8. Publish only after release-check passes.
9. Consumer discovers only the latest published non-prerelease release.
10. Keep previous valid release available for rollback.
```

- [ ] **Step 5: Add source documentation**

`docs/SOURCES.md` states intended OSM-derived source, requires exact provider/extract date/tool versions in P1, labels P0 bounds as conservative display envelopes, and disclaims OSM endorsement.

- [ ] **Step 6: Verify and commit**

```bash
npm test
npm run validate
git add README.md LICENSE-DATA.md NOTICE.md docs/FORMAT.md docs/RELEASES.md docs/SOURCES.md
git commit -m "docs: document map format releases and attribution"
```

---

### Task 8: Add CI and draft-release verification workflow

**Files:** `.github/workflows/validate.yml`, `.github/workflows/release-check.yml`

- [ ] **Step 1: Add source-validation workflow**

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

- [ ] **Step 2: Add manual draft-release check workflow**

`release-check.yml` uses `workflow_dispatch` input `release_tag`, `permissions: contents: read`, Node 22, and these core steps:

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
- name: Require manifest
  run: test -f release-staging/maps-manifest.json
- name: Require checksums when PMTiles exist
  run: |
    if find release-staging -maxdepth 1 -name '*.pmtiles' -print -quit | grep -q .; then
      test -f release-staging/SHA256SUMS.txt
    fi
- name: Validate manifest
  run: node scripts/validate-manifest.mjs release-staging/maps-manifest.json catalog/states.json
- name: Verify release assets
  run: node scripts/verify-release.mjs --manifest release-staging/maps-manifest.json --assets release-staging
```

P0 must not auto-publish a release.

- [ ] **Step 3: Verify locally and commit**

```bash
npm test
npm run validate
git add .github/workflows/validate.yml .github/workflows/release-check.yml
git commit -m "ci: validate catalog and draft map releases"
```

GitHub runtime/syntax validation is confirmed by the PR workflow after push.

---

### Task 9: Integrated verification and PR readiness

**Files:** no planned new source files; only regression fixes if evidence exposes a P0 defect.

- [ ] **Step 1: Run broad local verification**

```bash
npm test
npm run validate
mkdir -p release-staging
node scripts/verify-release.mjs --manifest catalog/maps-manifest.json --assets release-staging
git check-ignore -v x.pmtiles x.osm.pbf x.mbtiles release-staging/x.pmtiles
```

Expected: tests PASS, manifest valid, empty all-unavailable staging valid, all forbidden classes ignored.

- [ ] **Step 2: Regenerate initial manifest and compare**

```bash
mkdir -p tmp
node scripts/build-manifest.mjs --metadata catalog/build-metadata.json --output ./tmp/maps-manifest.generated.json --release-version 2026.09.0 --generated-at 2026-09-20T00:00:00Z
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('catalog/maps-manifest.json')); const b=JSON.parse(fs.readFileSync('./tmp/maps-manifest.generated.json')); require('assert').deepStrictEqual(a,b); console.log('manifest match')"
```

Expected: `manifest match`.

- [ ] **Step 3: Inspect diff and tracked files**

```bash
git status --short
git diff main...HEAD --stat
git diff main...HEAD -- . ':!package-lock.json'
git ls-files | grep -E '\.(pmtiles|osm\.pbf|mbtiles)$' && exit 1 || true
```

Expected: no forbidden binaries, secrets, tokens, generated archives, or out-of-scope files; no auto-publish workflow.

- [ ] **Step 4: Inspect fresh PR Actions result**

The `Validate map catalog` workflow on the implementation PR must be green. A previous or local-only run is insufficient evidence.

- [ ] **Step 5: Run independent Codex Engineering Guardrails verification**

Use `codex-engineering-guardrails:code-verification` read-only against `main...HEAD` with:

```text
28-package catalog -> catalog tests + manifest completeness tests
fail-closed manifest -> negative manifest tests + npm run validate
streaming integrity -> checksum test
release byte/sha verification -> verify-release negative tests
no binaries in Git -> .gitignore + git check-ignore + tracked-file inspection
published-release-only contract -> docs/RELEASES.md inspection
CI validation -> fresh PR Actions result
```

Verdict must be Pass/Partial/Fail/Inconclusive from fresh evidence.

- [ ] **Step 6: Mark PR ready only if clean**

Required before ready-for-review:

```text
local tests PASS
checked-in manifest validates
PR workflow green
independent verification has no material P0 defect
```

Do not merge automatically unless the user separately authorizes merge.
