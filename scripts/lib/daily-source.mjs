const BUILD_BASE_URL = 'https://build.protomaps.com';
const RELEASE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) { return String(value).padStart(2, '0'); }

export function candidateBuilds(now = new Date(), days = 7) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('now must be a valid Date');
  if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('days must be an integer between 1 and 31');
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start - offset * 86400000);
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const build = `${year}${month}${day}`;
    return {
      build,
      sourceDate: `${year}-${month}-${day}`,
      url: `${BUILD_BASE_URL}/${build}.pmtiles`
    };
  });
}

export async function resolveDailyBuild({ now = new Date(), days = 7, probe }) {
  if (typeof probe !== 'function') throw new Error('probe function is required');
  for (const candidate of candidateBuilds(now, days)) {
    if (await probe(candidate)) return candidate;
  }
  throw new Error(`no Protomaps daily build available in the last ${days} days`);
}

export async function probeHttpRange(candidate, fetchImpl = fetch) {
  const response = await fetchImpl(candidate.url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    redirect: 'follow'
  });
  try {
    return response.status === 206 || response.status === 200;
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

export function isSourceDate(value) {
  if (typeof value !== 'string' || !RELEASE_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
