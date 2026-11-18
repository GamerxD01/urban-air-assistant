/**
 * AQI maths based on the Indian National AQI (CPCB) PM2.5 breakpoints.
 * Only PM2.5 is used because it is the dominant pollutant in North-Indian winter smog.
 * @module engine/aqi
 */
import { clamp, mean, round1 } from './math.js';

/** @typedef {import('../types.js').AirQuality} AirQuality */
/** @typedef {import('../types.js').AirQualityInput} AirQualityInput */
/** @typedef {import('../types.js').TimeWindow} TimeWindow */

/**
 * @typedef {object} BandDefinition
 * @property {string} id
 * @property {string} label
 * @property {number} index
 * @property {[number, number]} pm PM2.5 range, µg/m³
 * @property {[number, number]} aqi AQI range
 */

/** @type {readonly BandDefinition[]} */
export const BANDS = Object.freeze([
  { id: 'good', label: 'Good', index: 0, pm: [0, 30], aqi: [0, 50] },
  { id: 'satisfactory', label: 'Satisfactory', index: 1, pm: [30, 60], aqi: [50, 100] },
  { id: 'moderate', label: 'Moderate', index: 2, pm: [60, 90], aqi: [100, 200] },
  { id: 'poor', label: 'Poor', index: 3, pm: [90, 120], aqi: [200, 300] },
  { id: 'very_poor', label: 'Very poor', index: 4, pm: [120, 250], aqi: [300, 400] },
  { id: 'severe', label: 'Severe', index: 5, pm: [250, 380], aqi: [400, 500] },
]);

export const MAX_PM25 = 380;
export const MAX_AQI = 500;
const HOURS = 24;
const SEVERE = BANDS[BANDS.length - 1];

/**
 * @param {number} pm25 µg/m³
 * @returns {BandDefinition}
 */
export function bandForPm25(pm25) {
  const pm = clamp(Number(pm25), 0, MAX_PM25);
  return BANDS.find((b) => pm <= b.pm[1]) ?? SEVERE;
}

/**
 * Convert a 24h PM2.5 concentration (µg/m³) to the Indian AQI.
 * @param {number} pm25
 * @returns {number}
 */
export function pm25ToAqi(pm25) {
  const pm = clamp(Number(pm25), 0, MAX_PM25);
  const band = bandForPm25(pm);
  const [pLo, pHi] = band.pm;
  const [aLo, aHi] = band.aqi;
  return Math.round(aLo + ((aHi - aLo) * (pm - pLo)) / (pHi - pLo));
}

/**
 * Inverse of {@link pm25ToAqi}; used when a user only knows the AQI shown on an app.
 * @param {number} aqi
 * @returns {number} PM2.5, µg/m³
 */
export function aqiToPm25(aqi) {
  const value = clamp(Number(aqi), 0, MAX_AQI);
  const band = BANDS.find((b) => value <= b.aqi[1]) ?? SEVERE;
  const [pLo, pHi] = band.pm;
  const [aLo, aHi] = band.aqi;
  return round1(pLo + ((pHi - pLo) * (value - aLo)) / (aHi - aLo));
}

/**
 * Typical winter hourly shape for the Indo-Gangetic plain: shallow boundary layer at night and
 * early morning, cleanest mid-afternoon. Used only when no hourly forecast is available.
 */
const DIURNAL_RAW = [
  1.15, 1.2, 1.25, 1.3, 1.3, 1.35, 1.4, 1.45, 1.35, 1.15, 0.95, 0.8, 0.7, 0.65, 0.65, 0.7, 0.85, 1.05, 1.25, 1.4, 1.45,
  1.4, 1.3, 1.2,
];
const DIURNAL_MEAN = mean(DIURNAL_RAW);
export const DIURNAL = Object.freeze(DIURNAL_RAW.map((v) => v / DIURNAL_MEAN));

/**
 * @param {number} dailyMean
 * @returns {number[]} 24 hourly values with that mean and a typical winter shape
 */
export function synthesizeHourly(dailyMean) {
  return DIURNAL.map((f) => round1(dailyMean * f));
}

/**
 * @typedef {object} WindowSearch
 * @property {number} [from] first start hour allowed
 * @property {number} [to] hour (exclusive) the window must end by
 * @property {number} [length] window length in hours
 * @property {'min' | 'max'} [mode] cleanest or dirtiest
 */

/** Cleanest 2 daylight hours (7am-7pm) for going out. */
export const BEST_WINDOW = Object.freeze(/** @type {WindowSearch} */ ({ from: 7, to: 19, length: 2, mode: 'min' }));
/** Dirtiest 3 hours of the day to avoid. */
export const WORST_WINDOW = Object.freeze(/** @type {WindowSearch} */ ({ from: 0, to: HOURS, length: 3, mode: 'max' }));

/**
 * Find the contiguous window of `length` hours with the lowest (or highest) average PM2.5.
 * @param {number[]} hourly
 * @param {WindowSearch} [search]
 * @returns {TimeWindow}
 */
export function findWindow(hourly, { from = 0, to = HOURS, length = 2, mode = 'min' } = {}) {
  /** @type {TimeWindow | null} */
  let best = null;
  for (let start = from; start + length <= to; start += 1) {
    const avg = mean(hourly.slice(start, start + length));
    if (best === null || (mode === 'min' ? avg < best.avg : avg > best.avg)) {
      best = { start, end: start + length, avg: round1(avg) };
    }
  }
  if (!best) throw new RangeError('Window search range is shorter than the window length.');
  return best;
}

/**
 * @param {unknown} hourly
 * @returns {hourly is number[]}
 */
const isValidHourly = (hourly) =>
  Array.isArray(hourly) && hourly.length === HOURS && hourly.every((v) => Number.isFinite(v) && v >= 0);

/**
 * Best available daily mean PM2.5: measured hourly series, then a PM2.5 value, then an AQI.
 * @param {{ hourly?: number[], pm25?: number, aqi?: number }} reading
 * @returns {number}
 * @throws {TypeError} when none of them is usable
 */
function dailyMeanFrom({ hourly, pm25, aqi }) {
  if (hourly) return round1(mean(hourly));
  if (typeof pm25 === 'number' && Number.isFinite(pm25) && pm25 >= 0) return round1(clamp(pm25, 0, MAX_PM25));
  if (typeof aqi === 'number' && Number.isFinite(aqi) && aqi >= 0) return aqiToPm25(aqi);
  throw new TypeError('Air quality needs an hourly series, a PM2.5 value or an AQI.');
}

/**
 * Normalise whatever the caller knows (live PM2.5 + hourly, a PM2.5 number or just an AQI)
 * into one consistent air-quality object used by the rest of the engine.
 * @param {AirQualityInput} [input]
 * @returns {AirQuality}
 * @throws {TypeError} when no usable reading is given
 */
export function normalizeAirQuality({ pm25, aqi, hourly, source = 'manual', location = null, asOf = null } = {}) {
  const measured = isValidHourly(hourly) ? hourly : undefined;
  const dailyMean = dailyMeanFrom({ hourly: measured, pm25, aqi });
  const hourlySeries = measured ?? synthesizeHourly(dailyMean);
  const band = bandForPm25(dailyMean);
  return {
    pm25: dailyMean,
    aqi: pm25ToAqi(dailyMean),
    band: { id: band.id, label: band.label, index: band.index },
    hourly: hourlySeries,
    hourlyIsEstimated: measured === undefined,
    bestWindow: findWindow(hourlySeries, BEST_WINDOW),
    worstWindow: findWindow(hourlySeries, WORST_WINDOW),
    source,
    location,
    asOf,
  };
}
