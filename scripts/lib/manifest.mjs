const RELEASE_VERSION_RE = /^[0-9]{4}\.[0-9]{2}\.[0-9]+$/;
const UTC_ISO_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]+))?Z$/;
const SOURCE_DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const KINDS = new Set(['national', 'state', 'federal-district']);
const TOP_LEVEL_KEYS = ['schemaVersion', 'releaseVersion', 'generatedAt', 'source', 'maps'];
const SOURCE_KEYS = ['provider', 'license'];
const MAP_KEYS = ['id', 'name', 'kind', 'available', 'version', 'asset', 'size', 'sha256', 'minZoom', 'maxZoom', 'bounds', 'sourceDate'];
const RELEASE_FIELDS = ['version', 'asset', 'size', 'sha256', 'sourceDate'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${label} has unexpected property ${key}`);
  }
  for (const key of allowed) {
    if (!(key in value)) errors.push(`${label} missing property ${key}`);
  }
  return true;
}

function validUtcIso(value) {
  if (typeof value !== 'string') return false;
  const match = UTC_ISO_RE.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const date = new Date(parsed);
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3])
    && date.getUTCHours() === Number(match[4])
    && date.getUTCMinutes() === Number(match[5])
    && date.getUTCSeconds() === Number(match[6]);
}

function validDateOnly(value) {
  if (typeof value !== 'string') return false;
  const match = SOURCE_DATE_RE.exec(value);
  if (!match) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  const date = new Date(parsed);
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3]);
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

function structuralErrors(manifest) {
  const errors = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS, 'manifest', errors)) return errors;

  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (typeof manifest.releaseVersion !== 'string' || !RELEASE_VERSION_RE.test(manifest.releaseVersion)) {
    errors.push('releaseVersion must match YYYY.MM.PATCH');
  }
  if (!validUtcIso(manifest.generatedAt)) errors.push('generatedAt must be a valid UTC ISO timestamp');

  if (exactKeys(manifest.source, SOURCE_KEYS, 'source', errors)) {
    if (manifest.source.provider !== 'OpenStreetMap') errors.push('source.provider must equal OpenStreetMap');
    if (manifest.source.license !== 'ODbL-1.0') errors.push('source.license must equal ODbL-1.0');
  }

  if (!Array.isArray(manifest.maps)) {
    errors.push('maps must be an array');
    return errors;
  }

  manifest.maps.forEach((entry, index) => {
    const label = `maps[${index}]`;
    if (!exactKeys(entry, MAP_KEYS, label, errors)) return;
    if (typeof entry.id !== 'string' || entry.id.length === 0) errors.push(`${label}.id must be a non-empty string`);
    if (typeof entry.name !== 'string' || entry.name.length === 0) errors.push(`${label}.name must be a non-empty string`);
    if (!KINDS.has(entry.kind)) errors.push(`${label}.kind is invalid`);
    if (typeof entry.available !== 'boolean') errors.push(`${label}.available must be boolean`);
    for (const field of ['version', 'asset', 'sha256', 'sourceDate']) {
      if (entry[field] !== null && typeof entry[field] !== 'string') errors.push(`${label}.${field} must be string or null`);
    }
    if (entry.size !== null && !Number.isInteger(entry.size)) errors.push(`${label}.size must be integer or null`);
    if (!Number.isInteger(entry.minZoom) || entry.minZoom < 0 || entry.minZoom > 22) errors.push(`${label}.minZoom must be integer 0..22`);
    if (!Number.isInteger(entry.maxZoom) || entry.maxZoom < 0 || entry.maxZoom > 22) errors.push(`${label}.maxZoom must be integer 0..22`);
    if (!Array.isArray(entry.bounds) || entry.bounds.length !== 4 || !entry.bounds.every(Number.isFinite)) {
      errors.push(`${label}.bounds must contain four finite numbers`);
    }
  });

  return errors;
}

export function expectedAssetName(id) {
  return id === 'brasil-base' ? 'brasil-base.pmtiles' : `${id}.pmtiles`;
}

export async function validateManifest(manifest, catalog) {
  const errors = structuralErrors(manifest);
  if (!Array.isArray(manifest?.maps) || !Array.isArray(catalog)) return { valid: errors.length === 0, errors };

  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const seen = new Set();

  for (const entry of manifest.maps) {
    if (!isObject(entry) || typeof entry.id !== 'string') continue;
    if (seen.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
    seen.add(entry.id);

    const stable = catalogById.get(entry.id);
    if (!stable) {
      errors.push(`unknown id: ${entry.id}`);
      continue;
    }

    if (entry.name !== stable.name || entry.kind !== stable.kind || entry.minZoom !== stable.minZoom || entry.maxZoom !== stable.maxZoom || !sameArray(entry.bounds, stable.bounds)) {
      errors.push(`stable field mismatch for ${entry.id}`);
    }

    if (Number.isInteger(entry.minZoom) && Number.isInteger(entry.maxZoom) && entry.minZoom > entry.maxZoom) {
      errors.push(`invalid zoom range for ${entry.id}`);
    }

    if (Array.isArray(entry.bounds) && entry.bounds.length === 4 && entry.bounds.every(Number.isFinite)) {
      const [west, south, east, north] = entry.bounds;
      if (!(west < east && south < north)) errors.push(`invalid bounds for ${entry.id}`);
    }

    if (entry.available === true) {
      const missing = RELEASE_FIELDS.filter((field) => entry[field] === null || entry[field] === undefined || entry[field] === '');
      if (missing.length) errors.push(`available entry ${entry.id} requires ${missing.join(', ')}`);

      if (typeof entry.asset === 'string') {
        if (entry.asset.includes('/') || entry.asset.includes('\\') || entry.asset.includes('..')) {
          errors.push(`unsafe asset name for ${entry.id}`);
        } else if (entry.asset !== expectedAssetName(entry.id)) {
          errors.push(`asset name mismatch for ${entry.id}: expected ${expectedAssetName(entry.id)}`);
        }
      }
      if (typeof entry.version === 'string' && !RELEASE_VERSION_RE.test(entry.version)) errors.push(`invalid version for ${entry.id}`);
      if (!Number.isInteger(entry.size) || entry.size <= 0) errors.push(`invalid size for ${entry.id}`);
      if (typeof entry.sha256 !== 'string' || !SHA256_RE.test(entry.sha256)) errors.push(`invalid sha256 for ${entry.id}`);
      if (!validDateOnly(entry.sourceDate)) {
        errors.push(`invalid sourceDate for ${entry.id}`);
      }
    } else if (entry.available === false) {
      const present = RELEASE_FIELDS.filter((field) => entry[field] !== null);
      if (present.length) errors.push(`unavailable entry ${entry.id} must keep release metadata null: ${present.join(', ')}`);
    }
  }

  for (const id of catalogById.keys()) {
    if (!seen.has(id)) errors.push(`missing catalog id: ${id}`);
  }

  if (manifest.maps.length !== catalog.length) errors.push(`manifest map count ${manifest.maps.length} does not match catalog count ${catalog.length}`);

  return { valid: errors.length === 0, errors };
}
