/**
 * Live location and air quality via Open-Meteo (free, no API key; CAMS forecast data).
 * `fetchImpl` and `now` are injectable so the module is testable without network access.
 * @module services/airQuality
 */
import { UPSTREAM } from '../config.js';
import { UpstreamError } from '../errors.js';
import { TtlCache } from '../lib/ttlCache.js';

export { UpstreamError };

/** @typedef {import('../types.js').AirQualityInput} AirQualityInput */

/**
 * @typedef {object} Place
 * @property {string} name
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * @typedef {object} Reading
 * @property {number[] | undefined} hourly 24 hourly PM2.5 values when available
 * @property {number | undefined} pm25 current PM2.5 when the hourly series is incomplete
 * @property {string | null} asOf
 */

/** @typedef {{ fetchImpl?: typeof fetch, now?: number }} RequestOptions */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HOURS_PER_DAY = 24;
const COORD_DECIMALS = 2; // ~1 km: nearby lookups share a cache entry

/** @type {TtlCache<Place | Reading>} */
const cache = new TtlCache({ ttlMs: UPSTREAM.cacheTtlMs, maxEntries: UPSTREAM.cacheMax });

/** Empties the upstream cache (used by tests). */
export function clearCache() {
  cache.clear();
}

/**
 * GET a JSON document, mapping every failure to an UpstreamError with a user-safe message.
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<any>}
 */
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

/**
 * Resolves a city name to coordinates.
 * @param {string} query
 * @param {RequestOptions} [options]
 * @returns {Promise<Place>}
 * @throws {UpstreamError} 404 when no place matches
 */
export async function geocode(query, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = `geo:${query.toLowerCase()}`;
  const cached = /** @type {Place | undefined} */ (cache.get(key, now));
  if (cached) return cached;

  const url = `${GEO_URL}?${new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' })}`;
  const data = await getJson(url, fetchImpl);
  const hit = data?.results?.[0];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) {
    throw new UpstreamError(`No place found for "${query}".`, 404);
  }
  /** @type {Place} */
  const place = {
    name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
  cache.set(key, place, now);
  return place;
}

/**
 * Extracts the next 24 hourly PM2.5 values, or the current reading if the series is incomplete.
 * @param {any} data Open-Meteo air-quality response
 * @returns {Reading}
 * @throws {UpstreamError} when there is no usable PM2.5 at all
 */
export function parseAirQualityResponse(data) {
  const asOf = data?.current?.time ?? null;
  const series = data?.hourly?.pm2_5;
  /** @type {unknown[]} */
  const day = Array.isArray(series) ? series.slice(0, HOURS_PER_DAY) : [];
  if (day.length === HOURS_PER_DAY && day.every((v) => Number.isFinite(v))) {
    return { hourly: /** @type {number[]} */ (day), pm25: undefined, asOf };
  }
  const current = data?.current?.pm2_5;
  if (Number.isFinite(current)) return { hourly: undefined, pm25: current, asOf };
  throw new UpstreamError('No PM2.5 reading is available for this location right now.');
}

/**
 * Today's PM2.5 forecast for a location.
 * @param {{ latitude: number, longitude: number }} coords
 * @param {RequestOptions} [options]
 * @returns {Promise<Reading>}
 */
export async function fetchAirQuality({ latitude, longitude }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = `aq:${latitude.toFixed(COORD_DECIMALS)},${longitude.toFixed(COORD_DECIMALS)}`;
  const cached = /** @type {Reading | undefined} */ (cache.get(key, now));
  if (cached) return cached;

  const url = `${AQ_URL}?${new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'pm2_5',
    hourly: 'pm2_5',
    forecast_days: '1',
    timezone: 'auto',
  })}`;
  const result = parseAirQualityResponse(await getJson(url, fetchImpl));
  cache.set(key, result, now);
  return result;
}

/**
 * City name → air-quality input for the engine.
 * @param {string} city
 * @param {RequestOptions} [options]
 * @returns {Promise<AirQualityInput>}
 */
export async function airQualityForCity(city, options) {
  const place = await geocode(city, options);
  const reading = await fetchAirQuality(place, options);
  return {
    hourly: reading.hourly,
    pm25: reading.pm25,
    asOf: reading.asOf,
    source: 'open-meteo',
    location: { name: place.name, latitude: place.latitude, longitude: place.longitude },
  };
}
