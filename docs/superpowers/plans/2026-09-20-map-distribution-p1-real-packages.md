# Map Distribution P1 Real Packages Implementation Plan

**Goal:** Generate the first real offline map packages (`brasil-base.pmtiles` and `sp.pmtiles`) from a recent Protomaps/OpenStreetMap daily build, validate them end-to-end, and stage them in a GitHub Release draft without publishing it.

**Architecture:** Resolve the newest available daily Protomaps planet build from the last seven UTC days. Use the pinned PMTiles CLI to extract only the catalog-defined bounding boxes and zoom ranges over HTTP Range Requests, then reuse P0 metadata/manifest/checksum/release validation before uploading to a draft release and downloading the draft assets again for a round-trip verification.

## Constraints

- No ArtiSys server and no paid API.
- No full planet download.
- No real PMTiles committed to Git.
- `brasil-base` uses catalog zoom 0–7.
- `sp` uses catalog zoom 7–14.
- Source discovery fails closed if no recent daily build is reachable.
- Existing published releases are never overwritten.
- Release stays draft after P1.
- PMTiles CLI is pinned to v1.31.2 for reproducibility.

## Tasks

1. Add tested daily-build resolution with a one-byte HTTP Range probe.
2. Derive extraction bounds/zoom directly from `catalog/states.json` so CI does not duplicate geographic configuration.
3. Add tested build-metadata generation from real file size/SHA-256 and catalog zooms.
4. Add `P1 generate real map packages` GitHub Actions workflow that installs the pinned PMTiles CLI, extracts both packages, runs `pmtiles verify`, builds manifest/checksums, and verifies local staging.
5. Create/update `br-maps-v2026.09.0` as a draft, upload assets, download them again through GitHub release APIs, and re-run manifest/release validation.
6. Record the source build, actual sizes, checksums, and workflow evidence after the first successful run.

## Acceptance evidence

- Existing P0 suite plus P1 unit tests all pass.
- `Validate map catalog` remains green.
- P1 workflow reports successful `pmtiles verify` for both real archives.
- `maps-manifest.json` marks only `brasil-base` and `sp` available.
- Draft release contains both PMTiles plus manifest, checksum file, and source provenance.
- Round-trip download verification passes.
