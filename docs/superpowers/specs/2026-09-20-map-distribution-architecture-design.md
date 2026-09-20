# Map Distribution Architecture Design

## Purpose

`mapasbrasilrelease` is the public distribution repository for offline Brazilian basemap packages consumed by ArtiSys Lavoura and, later, other ArtiSys products.

A customer must be able to install ArtiSys Lavoura, discover map packages, download a state package directly from GitHub Releases, verify it locally, and use it offline afterward without an ArtiSys server, paid API, login, subscription, or Google Maps dependency.

## Success criteria

The first implementation is successful when:

- Brazil, the 26 states, and the Federal District have stable machine-readable catalog identities;
- large `.pmtiles` files are never committed to Git history;
- the runtime catalog is distributed as a small manifest attached to a published GitHub Release;
- every available map declares exact byte size and SHA-256;
- invalid or incomplete manifests fail validation;
- incomplete releases remain drafts and are never advertised to consumers;
- OpenStreetMap provenance, attribution, and data-license obligations are documented;
- generation is independent from the consumer application and reproducible on a local PC or Woodpecker worker;
- the Lavoura application can consume the release contract without knowing how packages were generated.

## Non-goals

This repository does not implement MapLibre rendering, Lavoura UI, GPS, talhão drawing, crop layers, mobile synchronization, or satellite imagery. Those belong to consumer applications.

The first milestone also does not generate all detailed state packages. It establishes the catalog, manifest contract, validation, integrity tooling, release procedure, CI checks, and documentation. Real generation begins in the next milestone with `brasil-base.pmtiles` and `sp.pmtiles`.

## Core constraints

1. Mandatory infrastructure cost remains R$ 0.
2. No ArtiSys-owned application server is required.
3. The repository remains public for anonymous release-asset downloads.
4. Large map binaries exist only as GitHub Release assets, never in normal Git commits.
5. Consumers verify downloaded bytes before accepting a map.
6. The manifest contract is explicitly versioned.
7. OSM attribution remains visible in consumer products rendering OSM-derived data.
8. Source and transformation provenance are documented.
9. Generation is reproducible outside GitHub Actions.
10. Failed or partial builds never become advertised as available.
11. A release is created as a draft, verified, and only then published.

## Responsibilities

The repository has four responsibilities:

1. **Catalog contract** — stable identities and metadata for supported geographic packages.
2. **Validation tooling** — schema, semantic, naming, checksum, and release validation.
3. **Release distribution** — immutable published release assets consumed by applications.
4. **Build/publish automation** — reusable scripts callable from local Windows/Linux environments, Woodpecker, or GitHub Actions.

It is not a tile server. GitHub Releases is the file-distribution layer.

## Repository layout

```text
mapasbrasilrelease/
├─ README.md
├─ package.json
├─ .gitignore
├─ LICENSE-DATA.md
├─ NOTICE.md
├─ catalog/
│  ├─ states.json
│  ├─ maps-manifest.json
│  └─ maps-manifest.schema.json
├─ scripts/
│  ├─ validate-manifest.mjs
│  ├─ checksum.mjs
│  ├─ build-manifest.mjs
│  └─ verify-release.mjs
├─ tests/
│  ├─ manifest.test.mjs
│  └─ fixtures/
├─ docs/
│  ├─ FORMAT.md
│  ├─ RELEASES.md
│  ├─ SOURCES.md
│  └─ superpowers/specs/
└─ .github/workflows/
   ├─ validate.yml
   └─ release-check.yml
```

Small support files may be added during implementation. Raw or generated geographic binaries remain untracked.

## Geographic catalog

`catalog/states.json` is the authoritative geographic identity list. It contains exactly 28 entries:

- `brasil-base`;
- 26 Brazilian states using lowercase two-letter UF identifiers;
- Federal District as `df`.

Entries contain stable identity and geographic metadata only. Release availability belongs to the manifest.

## Manifest contract

`catalog/maps-manifest.json` is the repository copy used for validation/development. At runtime, the **canonical manifest is the `maps-manifest.json` asset attached to the latest published `br-maps-v...` GitHub Release**. Draft releases are never runtime sources.

Top-level shape:

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

Each map entry follows this shape:

```json
{
  "id": "sp",
  "name": "São Paulo",
  "kind": "state",
  "available": false,
  "version": null,
  "asset": null,
  "size": null,
  "sha256": null,
  "minZoom": 7,
  "maxZoom": 14,
  "bounds": [-53.2, -25.4, -44.1, -19.7],
  "sourceDate": null
}
```

When `available` is `true`, `version`, `asset`, `size`, `sha256`, and `sourceDate` are mandatory and non-null. When `available` is `false`, those release-specific fields are null.

`asset` is only the release filename, never a hard-coded absolute URL. Consumers derive downloads from the repository plus the published release identified by `releaseVersion`. This keeps the manifest portable and keeps asset identity immutable within a release.

## Naming convention

Release assets use deterministic lowercase names:

```text
brasil-base.pmtiles
ac.pmtiles
al.pmtiles
ap.pmtiles
am.pmtiles
ba.pmtiles
ce.pmtiles
df.pmtiles
es.pmtiles
go.pmtiles
ma.pmtiles
mt.pmtiles
ms.pmtiles
mg.pmtiles
pa.pmtiles
pb.pmtiles
pr.pmtiles
pe.pmtiles
pi.pmtiles
rj.pmtiles
rn.pmtiles
rs.pmtiles
ro.pmtiles
rr.pmtiles
sc.pmtiles
sp.pmtiles
se.pmtiles
to.pmtiles
maps-manifest.json
SHA256SUMS.txt
```

A release cannot contain two assets representing the same catalog ID.

## Versioning

- `schemaVersion`: integer consumer-contract version. Initial value: `1`.
- `releaseVersion`: map-data release version in `YYYY.MM.PATCH` form.

Changing source data or rebuilding packages changes `releaseVersion`, not necessarily `schemaVersion`. A backwards-incompatible manifest shape increments `schemaVersion`.

Release tags use:

```text
br-maps-v2026.09.0
```

## Canonical runtime discovery

Consumers obtain the current catalog through GitHub's latest published release for this repository and retrieve its `maps-manifest.json` asset. A consumer may cache the last known valid manifest for offline use.

A consumer must never treat these as authoritative runtime catalogs:

- a manifest from an unpublished draft release;
- arbitrary files from a branch;
- PR artifacts;
- local generation output.

This distinction ensures that only a deliberately published, validated release is advertised to customers.

## Draft-to-publish release protocol

Publishing is fail-closed:

1. generate candidate PMTiles locally or on an authorized worker;
2. calculate byte size and SHA-256 after generation finishes;
3. build the candidate manifest from verified metadata;
4. run schema and semantic validation;
5. create a **draft** GitHub Release;
6. upload candidate `.pmtiles`, `maps-manifest.json`, and `SHA256SUMS.txt` to that draft;
7. verify the draft's asset names, sizes, and checksums against the manifest;
8. publish the release only after all verification succeeds.

If any step fails, the release remains draft or is discarded. It must not become the latest published release.

A valid published release contains:

- zero or more verified `.pmtiles` assets;
- `maps-manifest.json` matching the release assets;
- `SHA256SUMS.txt` covering every available map asset.

The initial scaffolding release may contain zero PMTiles assets with every package marked unavailable.

## Consumer download flow

```text
ArtiSys Lavoura
    ↓
resolve latest published map release
    ↓
download maps-manifest.json
    ↓
validate supported schema
    ↓
show package list
    ↓
customer chooses state
    ↓
download .pmtiles to temporary file
    ↓
verify exact byte size
    ↓
verify SHA-256
    ↓
atomically move into local maps directory
    ↓
use offline through MapLibre/PMTiles
```

An interrupted or corrupt download never replaces an existing known-good map.

## Manifest generation

`build-manifest.mjs` is deterministic. It consumes `states.json` plus verified package-build metadata and emits the manifest.

File presence alone never implies availability. A package becomes `available: true` only when verified metadata contains:

- catalog ID;
- package version;
- source date;
- exact byte size;
- SHA-256;
- min/max zoom.

## Integrity model

SHA-256 detects corrupted, truncated, or mismatched package bytes. The publishing process writes the same digest into `maps-manifest.json` and `SHA256SUMS.txt`. Consumers recompute SHA-256 after download.

The initial scope provides integrity detection, not cryptographic publisher identity. Signing can be introduced later as an additive mechanism without changing the basic package identity fields.

## Validation rules

Validation enforces at least:

- supported integer `schemaVersion`;
- unique geographic IDs;
- exactly the expected catalog IDs;
- no unknown geographic package;
- `<uf>.pmtiles` for state packages;
- `brasil-base.pmtiles` for national base;
- `available: true` requires all release metadata;
- `available: false` requires release-specific fields to be null;
- SHA-256 is exactly 64 lowercase hexadecimal characters;
- available `size` is a positive integer;
- zoom values are integers with `minZoom <= maxZoom`;
- bounds are four finite coordinates ordered `[west, south, east, north]` and within longitude/latitude ranges;
- release versions follow `YYYY.MM.PATCH`;
- asset filenames contain no path separators, traversal tokens, or unexpected extension;
- manifest `releaseVersion` agrees with the draft/published release tag being verified.

## CI responsibilities

### `validate.yml`

Runs on pushes and pull requests and performs dependency installation, tests, JSON Schema validation, semantic validation, and configured static checks. It does not generate production PMTiles.

### `release-check.yml`

Provides repeatable release-validation logic for candidate metadata and may certify published releases after the fact, but **publication itself must use the draft-to-publish protocol**. A post-publication workflow failure alone is not considered a safe publishing gate.

Large geographic generation is not a mandatory GitHub-hosted CI responsibility. It can run locally or on Woodpecker and hand verified artifacts to the publication process.

## Generation strategy

The next milestone uses openly licensed OpenStreetMap-derived extracts and produces PMTiles suitable for MapLibre.

Two initial scopes are required:

- `brasil-base`: low-detail national overview with conservative maximum zoom;
- state package: higher-detail regional output.

The exact transformation toolchain, zoom recipe, simplification, and package-size targets are selected only after generating and measuring `brasil-base.pmtiles` and `sp.pmtiles`. This prevents guessed size assumptions from becoming architecture.

## Source provenance

Every available package records `sourceDate`. `docs/SOURCES.md` documents:

- extract source;
- source license;
- attribution requirements;
- transformation tools and versions;
- reproducibility commands.

The repository must not imply endorsement by OpenStreetMap or its contributors.

## Licensing and attribution

OSM-derived data remains subject to applicable OpenStreetMap/ODbL obligations. `LICENSE-DATA.md` describes data-license obligations separately from source-code licensing.

`NOTICE.md` supplies consumer-facing attribution text including `© OpenStreetMap contributors` and a reference to the OpenStreetMap copyright/license page. Consumer applications remain responsible for displaying attribution while OSM-derived map data is visible.

## Security and failure behavior

The repository and consumer contract are fail-closed:

- malformed manifests are rejected;
- unsupported schema versions are rejected;
- unexpected assets are not trusted automatically;
- checksum or byte-size mismatches reject downloads;
- path-like asset names are rejected;
- partially generated packages are never marked available;
- partial downloads never replace known-good maps;
- incomplete candidate releases remain drafts;
- published geographic binary assets use `.pmtiles` only.

## Git versus Release assets

Tracked Git contains only small source/configuration/documentation files. `.gitignore` blocks at least:

- `*.pmtiles`;
- `*.osm.pbf`;
- generated tile databases;
- temporary build directories;
- downloaded source archives.

Large release assets never enter Git history.

## Testing strategy

Tests use tiny deterministic fixtures rather than real map packages. Coverage includes:

- valid all-unavailable manifest;
- valid available-state metadata;
- missing and duplicate IDs;
- unknown ID;
- invalid asset filename/path traversal;
- invalid SHA-256;
- zero/negative size;
- inconsistent availability fields;
- invalid bounds;
- invalid zoom range;
- invalid release version/tag mismatch;
- checksum calculation against a small fixture;
- draft/release verification against a local fixture directory.

Real PMTiles generation and MapLibre rendering tests belong to later milestones.

## Initial delivery boundary

P0 for this repository is complete when it has:

1. catalog entries for `brasil-base`, 26 states, and DF;
2. schema version 1 expressed in JSON Schema;
3. initial manifest with every package unavailable;
4. semantic and schema validation with automated tests;
5. checksum tooling;
6. release-verification tooling;
7. documented draft-to-publish release protocol;
8. OSM provenance/license/attribution documentation;
9. GitHub validation workflows;
10. `.gitignore` protections against geographic binaries;
11. no large binary map files in Git history.

The next milestone is separate: generate and publish `brasil-base.pmtiles` and `sp.pmtiles`, measure actual sizes and generation time, then refine the generation recipe before producing the remaining states.
