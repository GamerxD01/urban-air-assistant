/**
 * Pure, DOM-free helpers shared by the UI modules. Kept separate so they can be unit-tested
 * in Node (see test/frontend.test.js).
 */

/** CSS custom properties holding the CPCB band colours, indexed by band 0 (good) to 5 (severe). */
export const BAND_VARS = Object.freeze(['--b0', '--b1', '--b2', '--b3', '--b4', '--b5']);

/** Upper PM2.5 edge (µg/m³) of each CPCB band except the last. */
const PM_EDGES = Object.freeze([30, 60, 90, 120, 250]);
const SEVERE_BAND = PM_EDGES.length;

/**
 * @param {number} pm25
 * @returns {number} band index 0..5
 */
export function bandOf(pm25) {
  const i = PM_EDGES.findIndex((edge) => pm25 <= edge);
  return i === -1 ? SEVERE_BAND : i;
}

/**
 * @param {number} hour 0..24
 * @returns {string} e.g. "12am", "3pm"
 */
export function hourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
}

/**
 * @param {{ start: number, end: number }} window
 * @returns {string} e.g. "from 12pm to 2pm"
 */
export function timeSpan(window) {
  return `from ${hourLabel(window.start)} to ${hourLabel(window.end)}`;
}

/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

/** @param {string} hex "#rrggbb" @returns {number[]} */
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Linear blend of two "#rrggbb" colours.
 * @param {string} from
 * @param {string} to
 * @param {number} t 0..1
 * @returns {string} "rgb(r,g,b)"
 */
export function mixColor(from, to, t) {
  const b = channels(to);
  return `rgb(${channels(from)
    .map((v, i) => Math.round(lerp(v, b[i], t)))
    .join(',')})`;
}

const HOUSEHOLD_FIELDS = Object.freeze(['children', 'elderly', 'respiratory', 'pregnant', 'outdoorWorker']);

/**
 * Builds the /api/plan request body from form values.
 * @param {(name: string) => string | null} get value of a named field (checkboxes give "on" or null)
 * @returns {{ city?: string, aqi?: number, profile: object }}
 */
export function toPlanRequest(get) {
  const isOn = (name) => get(name) === 'on';
  const request = {
    profile: {
      household: Object.fromEntries(HOUSEHOLD_FIELDS.map((f) => [f, isOn(f)])),
      lifestyle: {
        commute: get('commute'),
        commuteKm: get('commuteKm'),
        cooking: get('cooking'),
        heating: get('heating'),
        hasPurifier: isOn('hasPurifier'),
      },
    },
  };
  const city = String(get('city') ?? '').trim();
  const aqi = String(get('aqi') ?? '').trim();
  if (city) request.city = city;
  if (aqi) request.aqi = Number(aqi);
  return request;
}

/**
 * Client-side check run before submitting, mirroring the server's rules.
 * @param {{ city?: string, aqi?: number }} request
 * @returns {{ field: 'city' | 'aqi', message: string } | null}
 */
export function validatePlanRequest(request) {
  if (!request.city && request.aqi === undefined) {
    return { field: 'city', message: 'Type a city, or open "Enter the AQI from your phone instead".' };
  }
  if (request.aqi !== undefined && !(request.aqi >= 0 && request.aqi <= 500)) {
    return { field: 'aqi', message: 'The AQI needs to be a number from 0 to 500.' };
  }
  return null;
}
