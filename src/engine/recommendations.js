/**
 * Decides which advice a household sees today. The wording lives in data/advice.js; this module
 * only holds the rules and the numbers that fill the templates.
 * @module engine/recommendations
 */
import {
  COMMUNITY_ADVICE,
  COMMUTE_SWITCHES,
  INDOOR_ADVICE,
  PERSONAL_EXPOSURE_NOTES,
  ROUTINE_ADVICE,
} from '../data/advice.js';
import { commuteSwitchImpact, MODES } from './impact.js';
import { adviceItem, fillTemplate } from './template.js';

/** @typedef {import('../types.js').Item} Item */
/** @typedef {import('../types.js').PlanContext} PlanContext */
/** @typedef {import('../types.js').TimeWindow} TimeWindow */

/** CPCB bands: 0 good, 1 satisfactory, 2 moderate, 3 poor, 4 very poor, 5 severe. */
const BAND = Object.freeze({ SATISFACTORY: 1, MODERATE: 2, POOR: 3, VERY_POOR: 4 });
/** Household risk tiers from risk.js. */
const RISK = Object.freeze({ LOW: 1, HIGH: 3, VERY_HIGH: 4 });
const MINUTES_PER_HOUR = 60;
/** Longest one-way trip (km) for which cycling is suggested at all. */
const MAX_CYCLING_KM = 8;

/**
 * @param {number} hour
 * @returns {string} e.g. "12am", "3pm"
 */
function fmtHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
}

/**
 * @param {TimeWindow} window
 * @returns {string} e.g. "1pm-3pm"
 */
export const fmtWindow = (window) => `${fmtHour(window.start)}-${fmtHour(window.end)}`;

/**
 * @param {number} hours
 * @returns {string}
 */
const outdoorDuration = (hours) => (hours >= 1 ? '1 hour' : `${Math.round(hours * MINUTES_PER_HOUR)} minutes`);

/**
 * Values every routine template may use.
 * @param {PlanContext} ctx
 * @returns {Record<string, string | number>}
 */
function routineVars({ airQuality, impact, profile }) {
  const { bestWindow, worstWindow } = airQuality;
  return {
    band: airQuality.band.label.toLowerCase(),
    aqi: airQuality.aqi,
    best: fmtWindow(bestWindow),
    worst: fmtWindow(worstWindow),
    bestAvg: bestWindow.avg,
    pctDirtier: Math.round((worstWindow.avg / bestWindow.avg - 1) * 100),
    outdoorDuration: outdoorDuration(impact.outdoorHoursRecommended),
    onCommute: MODES[profile.lifestyle.commute].maskable ? ' and on your commute' : '',
  };
}

/**
 * Routine rules, checked in order. Adding advice means adding a rule, not editing a branch.
 * @type {{ applies: (ctx: PlanContext) => boolean, template: (ctx: PlanContext) => import('../data/advice.js').AdviceTemplate }[]}
 */
const ROUTINE_RULES = [
  { applies: () => true, template: () => ROUTINE_ADVICE.outdoorWindow },
  { applies: ({ airQuality }) => airQuality.band.index >= BAND.MODERATE, template: () => ROUTINE_ADVICE.avoidPeak },
  {
    applies: ({ profile, risk }) => profile.household.children || risk.tier >= RISK.VERY_HIGH,
    template: ({ profile }) => (profile.household.children ? ROUTINE_ADVICE.kidsPlay : ROUTINE_ADVICE.hardExercise),
  },
  { applies: ({ risk }) => risk.tier >= RISK.HIGH, template: () => ROUTINE_ADVICE.mask },
  { applies: ({ profile }) => profile.household.respiratory, template: () => ROUTINE_ADVICE.medical },
  {
    applies: ({ profile }) => profile.household.pregnant || profile.household.elderly,
    template: () => ROUTINE_ADVICE.vulnerable,
  },
  {
    applies: ({ profile, airQuality }) => profile.household.outdoorWorker && airQuality.band.index >= BAND.POOR,
    template: () => ROUTINE_ADVICE.outdoorWork,
  },
  {
    applies: ({ risk, airQuality }) => risk.sensitiveGroups.length > 0 && airQuality.band.index >= BAND.VERY_POOR,
    template: () => ROUTINE_ADVICE.scheduleFlex,
  },
];

/**
 * Today's routine: when to go out, when to stay in, and how to protect sensitive members.
 * @param {PlanContext} ctx
 * @returns {Item[]}
 */
export function buildRoutine(ctx) {
  const vars = routineVars(ctx);
  if (ctx.airQuality.band.index <= BAND.SATISFACTORY && ctx.risk.tier <= RISK.LOW) {
    return [adviceItem(ROUTINE_ADVICE.normalDay, vars)];
  }
  return ROUTINE_RULES.filter((rule) => rule.applies(ctx)).map((rule) => adviceItem(rule.template(ctx), vars));
}

/**
 * Indoor air-quality hacks, cheapest and most effective first.
 * @param {Pick<PlanContext, 'airQuality' | 'profile'>} ctx
 * @returns {Item[]}
 */
export function buildIndoorHacks({ airQuality, profile }) {
  const { band } = airQuality;
  const { lifestyle } = profile;
  if (band.index <= BAND.SATISFACTORY) return [adviceItem(INDOOR_ADVICE.ventilate)];

  const vars = { best: fmtWindow(airQuality.bestWindow) };
  const templates = [INDOOR_ADVICE.seal, lifestyle.hasPurifier ? INDOOR_ADVICE.purifier : INDOOR_ADVICE.diyFilter];
  if (lifestyle.cooking === 'biomass') templates.push(INDOOR_ADVICE.kitchenBiomass);
  if (lifestyle.cooking === 'lpg') templates.push(INDOOR_ADVICE.kitchenGas);
  if (lifestyle.heating === 'wood_coal') templates.push(INDOOR_ADVICE.heating);
  templates.push(INDOOR_ADVICE.cleanDust);
  if (band.index >= BAND.POOR) templates.push(INDOOR_ADVICE.noSmoke, INDOOR_ADVICE.plants);
  return templates.map((template) => adviceItem(template, vars));
}

/**
 * Wording for how a commute switch changes the user's own exposure.
 * @param {import('../types.js').CommuteSwitch} impact
 * @returns {string}
 */
function personalExposureNote(impact) {
  const pct = impact.personalInhalationChangeMaskedPct;
  if (pct === 0) return PERSONAL_EXPOSURE_NOTES.same;
  const maskNote =
    impact.personalInhalationChangeMaskedPct !== impact.personalInhalationChangePct ? ' (with a mask)' : '';
  return fillTemplate(pct < 0 ? PERSONAL_EXPOSURE_NOTES.lower : PERSONAL_EXPOSURE_NOTES.higher, {
    pct: Math.abs(pct),
    maskNote,
  });
}

/**
 * Cleaner commute options that actually save CO2 for this household.
 * @param {Pick<PlanContext, 'airQuality' | 'risk' | 'profile'>} ctx
 * @returns {Item[]}
 */
function commuteSwitches({ airQuality, risk, profile }) {
  const { lifestyle } = profile;
  const tooFarOrTooDirtyToCycle = lifestyle.commuteKm > MAX_CYCLING_KM || risk.tier >= RISK.VERY_HIGH;
  return COMMUTE_SWITCHES[lifestyle.commute]
    .filter(({ mode }) => !(mode === 'cycle' && tooFarOrTooDirtyToCycle))
    .map(({ mode, title }) => ({
      mode,
      title,
      impact: commuteSwitchImpact({ airQuality, lifestyle, riskTier: risk.tier }, mode),
    }))
    .filter(({ impact }) => impact.co2SavedKgPerWeek > 0)
    .map(({ mode, title, impact }) => ({
      ...adviceItem(COMMUNITY_ADVICE.commuteSwitch, {
        mode,
        switchTitle: title,
        km: lifestyle.commuteKm,
        personalNote: personalExposureNote(impact),
        co2: impact.co2SavedKgPerWeek,
      }),
      impact,
    }));
}

/**
 * Sustainable alternatives that clean the air for the household's street and city.
 * @param {Pick<PlanContext, 'airQuality' | 'risk' | 'profile'>} ctx
 * @returns {Item[]}
 */
export function buildSustainable(ctx) {
  const { lifestyle } = ctx.profile;
  const templates = [];
  if (lifestyle.cooking === 'biomass') templates.push(COMMUNITY_ADVICE.cleanCooking);
  if (lifestyle.heating === 'wood_coal') templates.push(COMMUNITY_ADVICE.cleanHeat);
  templates.push(COMMUNITY_ADVICE.noBurning, COMMUNITY_ADVICE.idleOff, COMMUNITY_ADVICE.schoolGroup);
  return [...commuteSwitches(ctx), ...templates.map((template) => adviceItem(template))];
}
