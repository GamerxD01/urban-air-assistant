/**
 * Validation and normalisation of the household profile. Everything the user can send is
 * whitelisted here, so the rest of the engine can trust its inputs.
 * @module engine/profile
 */
import { round1 } from './math.js';

/** @typedef {import('../types.js').Profile} Profile */
/** @typedef {import('../types.js').Household} Household */
/** @typedef {import('../types.js').CommuteMode} CommuteMode */

/** @type {readonly CommuteMode[]} */
export const COMMUTE_MODES = Object.freeze([
  'walk',
  'cycle',
  'two_wheeler',
  'car',
  'public_transport',
  'work_from_home',
]);
export const COOKING_FUELS = Object.freeze(['lpg', 'png', 'induction', 'biomass']);
export const HEATING_TYPES = Object.freeze(['none', 'electric', 'gas', 'wood_coal']);
export const HOME_TYPES = Object.freeze(['apartment', 'house']);

const MAX_COMMUTE_KM = 80;
const HOUSEHOLD_KEYS = /** @type {const} */ (['children', 'elderly', 'respiratory', 'pregnant', 'outdoorWorker']);

/** @type {Readonly<Profile>} */
export const DEFAULT_PROFILE = Object.freeze({
  household: { children: false, elderly: false, respiratory: false, pregnant: false, outdoorWorker: false },
  lifestyle: {
    commute: 'two_wheeler',
    commuteKm: 8,
    cooking: 'lpg',
    heating: 'none',
    homeType: 'apartment',
    hasPurifier: false,
  },
});

/**
 * Accepts real booleans and the string "true" (form posts); anything else is false.
 * @param {unknown} v
 * @returns {boolean}
 */
const asBool = (v) => v === true || v === 'true';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const asRecord = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};

/**
 * @template {string} T
 * @param {unknown} value raw input
 * @param {{ field: string, allowed: readonly T[], fallback: T }} spec
 * @param {string[]} errors collects a message when the value is not allowed
 * @returns {T}
 */
function pickEnum(value, { field, allowed, fallback }, errors) {
  if (value === undefined || value === null || value === '') return fallback;
  if (allowed.includes(/** @type {T} */ (value))) return /** @type {T} */ (value);
  errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  return fallback;
}

/**
 * @param {unknown} value
 * @param {CommuteMode} commute
 * @param {string[]} errors
 * @returns {number} one-way distance in km
 */
function pickCommuteKm(value, commute, errors) {
  if (commute === 'work_from_home') return 0;
  if (value === undefined || value === '') return DEFAULT_PROFILE.lifestyle.commuteKm;
  const km = Number(value);
  if (!Number.isFinite(km) || km < 0 || km > MAX_COMMUTE_KM) {
    errors.push(`commuteKm must be a number between 0 and ${MAX_COMMUTE_KM}`);
    return DEFAULT_PROFILE.lifestyle.commuteKm;
  }
  return round1(km);
}

/**
 * Whitelists a raw profile; invalid values fall back to safe defaults and are reported.
 * @param {unknown} raw
 * @returns {{ ok: boolean, value: Profile, errors: string[] }}
 */
export function normalizeProfile(raw) {
  /** @type {string[]} */
  const errors = [];
  const input = asRecord(raw);
  const hh = asRecord(input.household);
  const ls = asRecord(input.lifestyle);
  const defaults = DEFAULT_PROFILE.lifestyle;

  const household = /** @type {Household} */ (Object.fromEntries(HOUSEHOLD_KEYS.map((k) => [k, asBool(hh[k])])));
  const commute = pickEnum(
    ls.commute,
    { field: 'commute', allowed: COMMUTE_MODES, fallback: defaults.commute },
    errors,
  );

  return {
    ok: errors.length === 0 && true,
    value: {
      household,
      lifestyle: {
        commute,
        commuteKm: pickCommuteKm(ls.commuteKm, commute, errors),
        cooking: pickEnum(ls.cooking, { field: 'cooking', allowed: COOKING_FUELS, fallback: defaults.cooking }, errors),
        heating: pickEnum(ls.heating, { field: 'heating', allowed: HEATING_TYPES, fallback: defaults.heating }, errors),
        homeType: pickEnum(
          ls.homeType,
          { field: 'homeType', allowed: HOME_TYPES, fallback: defaults.homeType },
          errors,
        ),
        hasPurifier: asBool(ls.hasPurifier),
      },
    },
    errors,
  };
}

/**
 * Plain-language names of the vulnerable or exposed people in a household.
 * @param {Household} household
 * @returns {string[]}
 */
export function sensitiveGroups(household) {
  /** @type {string[]} */
  const labels = [];
  if (household.respiratory) labels.push('someone with asthma, COPD or a heart condition');
  if (household.children) labels.push('children');
  if (household.elderly) labels.push('older adults');
  if (household.pregnant) labels.push('a pregnant family member');
  if (household.outdoorWorker) labels.push('someone who works outdoors');
  return labels;
}
