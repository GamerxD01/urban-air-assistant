/**
 * Live location + air quality via Open-Meteo (free, no API key).
 * `fetchImpl` is injectable so the module is testable without network access.
 */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;

export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

const cache = new Map();

function cacheGet(key, now) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, now) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
}

export function clearCache() {
  cache.clear();
}

async function getJson(url, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
  } catch {
    throw new UpstreamError('The air-quality service could not be reached.');
  }
  if (!res.ok) throw new UpstreamError(`The air-quality service returned ${res.status}.`);
  try {
    return await res.json();
  } catch {
    throw new UpstreamError('The air-quality service returned an unreadable response.');
  }
}

export async function geocode(query, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = `geo:${query.toLowerCase()}`;
  const cached = cacheGet(key, now);
  if (cached) return cached;

  const url = `${GEO_URL}?${new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' })}`;
  const data = await getJson(url, fetchImpl);
  const hit = data?.results?.[0];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) {
    throw new UpstreamError(`No place found for "${query}".`, 404);
  }
  const place = {
    name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
  cacheSet(key, place, now);
  return place;
}

/**
 * Returns { hourly: number[24] | undefined, pm25, asOf } for the next 24 hours from "today" local midnight.
 * Falls back to the current reading when the hourly series is incomplete.
 */
export async function fetchAirQuality({ latitude, longitude }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = `aq:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = cacheGet(key, now);
  if (cached) return cached;

  const url = `${AQ_URL}?${new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'pm2_5',
    hourly: 'pm2_5',
    forecast_days: '1',
    timezone: 'auto',
  })}`;
  const data = await getJson(url, fetchImpl);

  const series = data?.hourly?.pm2_5;
  const current = data?.current?.pm2_5;
  let result;
  if (Array.isArray(series) && series.length >= 24 && series.slice(0, 24).every((v) => Number.isFinite(v))) {
    result = { hourly: series.slice(0, 24), pm25: undefined, asOf: data?.current?.time ?? null };
  } else if (Number.isFinite(current)) {
    result = { hourly: undefined, pm25: current, asOf: data?.current?.time ?? null };
  } else {
    throw new UpstreamError('No PM2.5 reading is available for this location right now.', 502);
  }
  cacheSet(key, result, now);
  return result;
}

export async function airQualityForCity(city, opts) {
  const place = await geocode(city, opts);
  const reading = await fetchAirQuality(place, opts);
  return {
    ...reading,
    source: 'open-meteo',
    location: { name: place.name, latitude: place.latitude, longitude: place.longitude },
  };
}
