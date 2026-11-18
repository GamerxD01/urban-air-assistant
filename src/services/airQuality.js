/**
 * Live location + air quality via Open-Meteo (free, no API key).
 * `fetchImpl` is injectable so the module is testable without network access.
 */

import { UPSTREAM } from '../config.js';
import { UpstreamError } from '../errors.js';

export { UpstreamError };

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HOURS_PER_DAY = 24;

const cache = new Map();

function cacheGet(key, now) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > UPSTREAM.cacheTtlMs) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, now) {
  if (cache.size >= UPSTREAM.cacheMax) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
}

export function clearCache() {
  cache.clear();
}

async function getJson(url, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(UPSTREAM.timeoutMs),
      headers: { accept: 'application/json' },
    });
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
 * Extracts the next 24 hourly PM2.5 values, or the current reading if the series is incomplete.
 * @param {any} data Open-Meteo air-quality response
 * @returns {{ hourly: number[] | undefined, pm25: number | undefined, asOf: string | null }}
 * @throws {UpstreamError} when there is no usable PM2.5 at all
 */
export function parseAirQualityResponse(data) {
  const asOf = data?.current?.time ?? null;
  const series = data?.hourly?.pm2_5;
  const day = Array.isArray(series) ? series.slice(0, HOURS_PER_DAY) : [];
  if (day.length === HOURS_PER_DAY && day.every((v) => Number.isFinite(v))) {
    return { hourly: day, pm25: undefined, asOf };
  }
  const current = data?.current?.pm2_5;
  if (Number.isFinite(current)) return { hourly: undefined, pm25: current, asOf };
  throw new UpstreamError('No PM2.5 reading is available for this location right now.');
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

  const result = parseAirQualityResponse(data);
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
