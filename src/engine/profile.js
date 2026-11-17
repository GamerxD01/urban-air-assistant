/**
 * Validation and normalisation of the household profile. Everything the user can send is
 * whitelisted here, so the rest of the engine can trust its inputs.
 */

export const COMMUTE_MODES = ['walk', 'cycle', 'two_wheeler', 'car', 'public_transport', 'work_from_home'];
export const COOKING_FUELS = ['lpg', 'png', 'induction', 'biomass'];
export const HEATING_TYPES = ['none', 'electric', 'gas', 'wood_coal'];
export const HOME_TYPES = ['apartment', 'house'];

const MAX_COMMUTE_KM = 80;

const asBool = (v) => v === true || v === 'true';

function pickEnum(value, allowed, fallback, field, errors) {
  if (value === undefined || value === null || value === '') return fallback;
  if (allowed.includes(value)) return value;
  errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  return fallback;
}

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
 * @returns {{ ok: boolean, value: typeof DEFAULT_PROFILE, errors: string[] }}
 */
export function normalizeProfile(raw) {
  const errors = [];
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const hh = input.household && typeof input.household === 'object' ? input.household : {};
  const ls = input.lifestyle && typeof input.lifestyle === 'object' ? input.lifestyle : {};

  const household = {
    children: asBool(hh.children),
    elderly: asBool(hh.elderly),
    respiratory: asBool(hh.respiratory),
    pregnant: asBool(hh.pregnant),
    outdoorWorker: asBool(hh.outdoorWorker),
  };

  const commute = pickEnum(ls.commute, COMMUTE_MODES, DEFAULT_PROFILE.lifestyle.commute, 'commute', errors);
  let commuteKm = ls.commuteKm === undefined || ls.commuteKm === '' ? DEFAULT_PROFILE.lifestyle.commuteKm : Number(ls.commuteKm);
  if (!Number.isFinite(commuteKm) || commuteKm < 0 || commuteKm > MAX_COMMUTE_KM) {
    errors.push(`commuteKm must be a number between 0 and ${MAX_COMMUTE_KM}`);
    commuteKm = DEFAULT_PROFILE.lifestyle.commuteKm;
  }
  if (commute === 'work_from_home') commuteKm = 0;

  const lifestyle = {
    commute,
    commuteKm: Math.round(commuteKm * 10) / 10,
    cooking: pickEnum(ls.cooking, COOKING_FUELS, DEFAULT_PROFILE.lifestyle.cooking, 'cooking', errors),
    heating: pickEnum(ls.heating, HEATING_TYPES, DEFAULT_PROFILE.lifestyle.heating, 'heating', errors),
    homeType: pickEnum(ls.homeType, HOME_TYPES, DEFAULT_PROFILE.lifestyle.homeType, 'homeType', errors),
    hasPurifier: asBool(ls.hasPurifier),
  };

  return { ok: errors.length === 0, value: { household, lifestyle }, errors };
}

export function sensitiveGroups(household) {
  const labels = [];
  if (household.respiratory) labels.push('someone with asthma, COPD or a heart condition');
  if (household.children) labels.push('children');
  if (household.elderly) labels.push('older adults');
  if (household.pregnant) labels.push('a pregnant family member');
  if (household.outdoorWorker) labels.push('someone who works outdoors');
  return labels;
}
