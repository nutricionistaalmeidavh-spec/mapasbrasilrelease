# Map Distribution Architecture Design

## Purpose

`mapasbrasilrelease` is the public distribution repository for offline map packages consumed by ArtiSys Lavoura and, later, other ArtiSys products that need Brazilian basemaps.

The repository must let a customer install ArtiSys Lavoura, discover available map packages, download a state package directly from GitHub Releases, verify it locally, and use it offline afterward without requiring an ArtiSys server, paid API, login, subscription, or Google Maps dependency.

## Success criteria

The first implementation is successful when:

- the repository contains a stable machine-readable catalog contract for Brazil, the 26 states, and the Federal District;
- large `.pmtiles` files are never committed to Git history;
- release assets can be discovered through a small manifest;
- every downloadable asset has a declared byte size and SHA-256 digest;
- invalid or incomplete manifests fail validation in CI;
- OpenStreetMap attribution and data-license requirements are documented;
- map package generation is independent from the consumer application;
- the design allows generation on a local PC or Woodpecker worker without requiring a paid cloud service;
- the Lavoura application can later consume the manifest without knowing how packages were produced.

## Non-goals for this repository

This repository does not implement the Lavoura user interface, MapLibre rendering, GPS, talhão drawing, crop layers, synchronization, or satellite imagery. Those belong to consumer applications.

This repository also does not require generating all 27 detailed packages in the first delivery. The first delivery establishes the contract, validation, publishing structure, and release conventions. Real map generation starts with `brasil-base.pmtiles` and `sp.pmtiles` in a later phase.

## Core constraints

1. Mandatory infrastructure cost must remain R$ 0.
2. No ArtiSys-owned application server is required for distribution.
3. The repository remains public so release assets are publicly downloadable.
4. Large map binaries belong only in GitHub Releases, never in regular Git commits.
5. The consumer must be able to validate a download without trusting transport alone.
6. The manifest contract must be versioned and backwards-conscious.
7. OpenStreetMap attribution must remain visible in consumer products that render OSM-derived data.
8. Data sources and transformation provenance must be documented.
9. The generation pipeline must be reproducible outside GitHub Actions.
10. A failed or interrupted package build must never publish a manifest that claims the package is available.

## Recommended architecture

The repository has four responsibilities:

1. **Catalog contract** — enumerate all supported geographic packages and describe availability, version, asset name, size, digest, zoom range, and source metadata.
2. **Validation tooling** — validate schema, semantic rules, checksums, naming, and release metadata.
3. **Release conventions** — define how binary PMTiles assets and manifests are attached to GitHub Releases.
4. **Build/publish automation** — provide scripts and CI hooks that can be used from GitHub Actions, Woodpecker, or a local workstation.

The repository does not act as a tile server. GitHub Releases acts only as the file distribution layer.

## Repository layout

```text
mapasbrasilrelease/
├─ README.md
├─ package.json
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
│  └─ superpowers/
│     └─ specs/
└─ .github/
   └─ workflows/
      ├─ validate.yml
      └─ release-check.yml
```

The implementation may add small support files such as `.gitignore` or Node configuration, but map binaries must remain outside tracked source.

## Geographic catalog

`catalog/states.json` is the authoritative list of supported first-level packages.

It contains exactly 28 entries:

- one national base package: `brasil-base`;
- 26 Brazilian states using lowercase two-letter UF identifiers;
- the Federal District as `df`.

State entries contain stable identity and geographic metadata only. Release state such as `available`, version, size, digest, and asset URL belongs in `maps-manifest.json`.

This separation prevents geographic identity from being coupled to a particular release.

## Manifest contract

`catalog/maps-manifest.json` is the consumer-facing catalog.

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

Each map entry follows this contract:

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

When `available` is `true`, the following fields are mandatory and non-null:

- `version`;
- `asset`;
- `size`;
- `sha256`;
- `sourceDate`.

When `available` is `false`, those release-specific fields must be null. This prevents a consumer from treating an unverified or incomplete asset as downloadable.

`asset` is a file name, not a hard-coded absolute GitHub URL. Consumer URLs are derived from the repository/release convention, allowing repository relocation or release-version changes without rewriting every entry.

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

A release must not contain two assets that map to the same catalog ID.

## Versioning

Two versions are separate:

- `schemaVersion`: integer contract version used by software consumers;
- `releaseVersion`: map data release version using `YYYY.MM.PATCH`.

Changing map data does not require changing `schemaVersion`.

A backwards-incompatible manifest shape requires incrementing `schemaVersion`.

The initial supported schema is `1`.

## Release convention

Map releases use tags:

```text
br-maps-v2026.09.0
```

The release must contain:

- zero or more verified `.pmtiles` assets;
- `maps-manifest.json` matching those assets;
- `SHA256SUMS.txt` for all downloadable map assets.

A release is considered valid only when every `available: true` entry has a matching release asset whose byte size and SHA-256 digest match the manifest.

The initial scaffolding release may contain no `.pmtiles` assets and all geographic packages marked unavailable.

## Distribution flow

The intended consumer flow is:

```text
ArtiSys Lavoura
    ↓
fetch small manifest
    ↓
show package list and availability
    ↓
customer chooses a state
    ↓
download release asset directly from GitHub
    ↓
verify expected byte size
    ↓
verify SHA-256
    ↓
atomically move verified file into local maps directory
    ↓
use offline through MapLibre/PMTiles
```

The consumer must download to a temporary file and rename/move it only after validation. An interrupted download must not replace a previously valid map.

## Manifest generation

`build-manifest.mjs` is deterministic. It reads the geographic catalog plus verified build metadata and emits `maps-manifest.json`.

The script must not infer availability merely because a filename exists in a working directory. A package becomes available only after build metadata contains:

- catalog ID;
- package version;
- source date;
- exact byte size;
- SHA-256 digest;
- min/max zoom.

This is intended to keep failed or half-produced files out of published catalogs.

## Integrity model

SHA-256 is the package-integrity mechanism.

The publishing workflow calculates the digest after generation. The manifest and `SHA256SUMS.txt` carry the same digest. Consumer applications compare the downloaded bytes to the manifest before accepting the file.

The initial scope is integrity detection, not cryptographic publisher identity. Artifact signing may be added later without changing the basic manifest fields.

## Validation rules

`validate-manifest.mjs` and the test suite enforce at least these rules:

- `schemaVersion` must equal a supported integer;
- geographic IDs must be unique;
- all IDs must exist in `states.json`;
- no catalog ID may be omitted from the manifest;
- no unknown geographic package may appear;
- state assets must use `<uf>.pmtiles`;
- the national asset must use `brasil-base.pmtiles`;
- `available: true` requires non-null release metadata;
- `available: false` requires release-specific fields to be null;
- SHA-256 values must be exactly 64 lowercase hexadecimal characters;
- size must be a positive integer when available;
- `minZoom` and `maxZoom` must be integers and `minZoom <= maxZoom`;
- bounds must contain four finite numbers in `[west, south, east, north]` order;
- release version must follow `YYYY.MM.PATCH`;
- asset names must contain no path traversal or path separators.

## CI responsibilities

### `validate.yml`

Runs on pushes and pull requests and performs:

1. dependency installation;
2. automated tests;
3. JSON Schema validation;
4. semantic manifest validation;
5. formatting/static checks where configured.

This workflow does not generate large PMTiles files.

### `release-check.yml`

Validates release metadata and release assets when a map release is being prepared or published. It verifies that manifest-declared assets exist and match size/checksum metadata.

Large geographic generation is intentionally not a mandatory GitHub-hosted CI responsibility. Generation can run on a local workstation or Woodpecker agent and then hand verified artifacts to the publication step.

## Generation strategy

The later generation phase will use openly licensed OpenStreetMap-derived source data and PMTiles output suitable for MapLibre.

The build system must support two scopes:

- `brasil-base`: low-detail national overview with conservative maximum zoom;
- state packages: higher-detail regional packages.

Exact source tooling and zoom/detail recipes will be measured during the first real-package phase because file size and generation time must be observed rather than guessed.

## Source provenance

Each release records the source date of every available package.

`docs/SOURCES.md` documents:

- where source extracts are obtained;
- source data license;
- attribution requirements;
- transformation tools and versions;
- reproducibility commands used by the project.

The repository must not imply that OpenStreetMap or its contributors endorse ArtiSys.

## Licensing and attribution

OSM-derived packages are database/data artifacts and remain subject to OpenStreetMap's ODbL terms and attribution requirements.

`LICENSE-DATA.md` explains the data-license obligations separately from the source-code license.

`NOTICE.md` supplies consumer-facing attribution wording suitable for displaying in applications, including `© OpenStreetMap contributors` and a reference to the OpenStreetMap copyright/license page.

The consumer application remains responsible for rendering attribution while map data is visible.

## Security and failure behavior

The repository and consumer contract are fail-closed:

- malformed manifests are rejected;
- unknown schema versions are rejected unless explicitly supported;
- unexpected assets are not automatically trusted;
- checksum mismatches reject the download;
- byte-size mismatches reject the download;
- path-like asset names are rejected;
- a partially generated package is never marked available;
- a partially downloaded package never replaces a known-good local package.

The design avoids executable content in map packages; published geographic assets use the `.pmtiles` format only.

## Repository source versus release assets

Tracked Git content contains only small text/code/configuration files.

The following must not be committed:

- `.pmtiles` packages;
- raw `.osm.pbf` extracts;
- generated tile databases;
- temporary map-build directories;
- downloaded regional source archives.

`.gitignore` will enforce these classes during implementation.

## Testing strategy

Tests are deterministic and use small fixtures rather than real map binaries.

Coverage includes:

- valid unavailable state catalog;
- valid available state metadata;
- missing state;
- duplicate ID;
- unknown ID;
- invalid asset filename;
- invalid SHA-256;
- zero/negative size;
- inconsistent availability fields;
- invalid bounds;
- invalid zoom range;
- invalid release version;
- checksum calculation against a small fixture;
- release verification against a mocked/local asset directory.

Real PMTiles generation and rendering tests belong to the later package-generation and Lavoura integration phases.

## Initial delivery boundary

The first implementation milestone for this repository is complete when it has:

1. all 26 states, the Federal District, and `brasil-base` represented in the catalog;
2. schema version 1 encoded in JSON Schema;
3. an initial manifest with every package unavailable;
4. manifest validation scripts and automated tests;
5. checksum tooling;
6. release verification tooling;
7. OSM provenance/license/attribution documentation;
8. GitHub validation workflows;
9. documented release naming and publication procedure;
10. no large binary map files in Git history.

The next milestone is deliberately separate: generate and publish `brasil-base.pmtiles` and `sp.pmtiles`, measure their actual sizes, then refine the generation recipe before producing the remaining states.
