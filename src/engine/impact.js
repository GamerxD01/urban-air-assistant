/**
 * Quantifies the direct effect of daily choices.
 *
 * The model is deliberately simple and transparent: for every part of a typical day we multiply
 *   outdoor PM2.5 x (indoor/in-vehicle infiltration ratio) x (breathing rate) x (hours)
 * to get the micrograms of PM2.5 a person inhales. All constants are rounded, literature-style
 * approximations (see README "Assumptions"); outputs are illustrative, not clinical.
 * @module engine/impact
 */
import { mean, pctChange, round1, round2 } from './math.js';

/** @typedef {import('../types.js').AirQuality} AirQuality */
/** @typedef {import('../types.js').Lifestyle} Lifestyle */
/** @typedef {import('../types.js').Risk} Risk */
/** @typedef {import('../types.js').Impact} Impact */
/** @typedef {import('../types.js').Lever} Lever */
/** @typedef {import('../types.js').DayExposure} DayExposure */
/** @typedef {import('../types.js').CommuteMode} CommuteMode */
/** @typedef {import('../types.js').CommuteSwitch} CommuteSwitch */

/** Berkeley Earth rule of thumb: ~22 µg/m³ of PM2.5 over 24h is comparable to one cigarette/day. */
export const UG_PER_CIGARETTE = 22;
const HOURS_PER_DAY = 24;
const TRIPS_PER_DAY = 2;
const WORKING_DAYS_PER_WEEK = 5;
const COMMUTE_RUSH_HOURS = Object.freeze([9, 18]);
const BASELINE_LEISURE_HOUR = 7; // the classic "morning walk" slot
const LEISURE_BREATHING_RATE = 1.3;
const INDOOR_BREATHING_RATE = 0.5;
/** Share of PM2.5 still inhaled through a well-fitted N95/FFP2 respirator (real-world, not lab). */
const MASK_PASS_THROUGH = 0.2;

const INDOOR_RATIO = Object.freeze({
  typical: 0.85, // windows opened now and then
  diyFilter: 0.55, // windows shut + DIY box-fan filter
  purifier: 0.35, // windows shut + HEPA purifier running
});

/**
 * @typedef {object} TravelMode
 * @property {number} speed km/h
 * @property {number} rate breathing rate, m³/h
 * @property {number} ratio share of outdoor PM2.5 that reaches the traveller
 * @property {number} co2PerKm tailpipe kg CO2 per passenger-km
 * @property {boolean} maskable whether a mask is practical in this mode
 */

/** @type {Readonly<Record<CommuteMode, TravelMode>>} */
export const MODES = Object.freeze({
  walk: { speed: 4.5, rate: 1.3, ratio: 1.0, co2PerKm: 0, maskable: true },
  cycle: { speed: 12, rate: 1.9, ratio: 1.0, co2PerKm: 0, maskable: true },
  two_wheeler: { speed: 22, rate: 0.9, ratio: 1.0, co2PerKm: 0.045, maskable: true },
  car: { speed: 22, rate: 0.5, ratio: 0.6, co2PerKm: 0.17, maskable: false },
  /** Same car, two people sharing it: identical exposure, half the emissions per person. */
  carpool: { speed: 22, rate: 0.5, ratio: 0.6, co2PerKm: 0.085, maskable: false },
  public_transport: { speed: 18, rate: 0.7, ratio: 0.8, co2PerKm: 0.035, maskable: true },
  work_from_home: { speed: 1, rate: 0, ratio: 0, co2PerKm: 0, maskable: false },
});

/** @typedef {{ mask: boolean, shiftOutdoor: boolean, indoorUpgrade: boolean }} Scenario */
/** @typedef {keyof Scenario} LeverId */

/** @type {readonly LeverId[]} */
const LEVER_IDS = Object.freeze(['mask', 'shiftOutdoor', 'indoorUpgrade']);
/** @type {Scenario} */
const NO_CHANGES = Object.freeze({ mask: false, shiftOutdoor: false, indoorUpgrade: false });

/**
 * @typedef {object} DayContext
 * @property {AirQuality} airQuality
 * @property {Lifestyle} lifestyle
 * @property {number} outdoorHours
 * @property {number} indoorRatioImproved
 */

/**
 * Inhaled dose for one day under a scenario.
 * @param {DayContext} ctx
 * @param {Scenario} scenario
 * @returns {DayExposure}
 */
function simulateDay({ airQuality, lifestyle, outdoorHours, indoorRatioImproved }, scenario) {
  const { hourly, pm25 } = airQuality;
  const mode = MODES[lifestyle.commute];
  const tripHours = lifestyle.commute === 'work_from_home' ? 0 : lifestyle.commuteKm / mode.speed;

  let dose = 0;
  let volume = 0;

  // Commute: two trips per day at rush hours.
  const maskCommute = scenario.mask && mode.maskable;
  for (const hour of COMMUTE_RUSH_HOURS) {
    const exposure = hourly[hour] * mode.ratio * mode.rate * tripHours;
    dose += maskCommute ? exposure * MASK_PASS_THROUGH : exposure;
    volume += mode.rate * tripHours;
  }

  // Outdoor leisure / errands.
  const leisureConc = scenario.shiftOutdoor ? airQuality.bestWindow.avg : hourly[BASELINE_LEISURE_HOUR];
  const leisureHours = scenario.shiftOutdoor ? outdoorHours : 1;
  const leisureDose = leisureConc * LEISURE_BREATHING_RATE * leisureHours;
  dose += scenario.mask ? leisureDose * MASK_PASS_THROUGH : leisureDose;
  volume += LEISURE_BREATHING_RATE * leisureHours;

  // Everything else happens indoors.
  const indoorHours = Math.max(0, HOURS_PER_DAY - TRIPS_PER_DAY * tripHours - leisureHours);
  const indoorRatio = scenario.indoorUpgrade ? indoorRatioImproved : INDOOR_RATIO.typical;
  dose += pm25 * indoorRatio * INDOOR_BREATHING_RATE * indoorHours;
  volume += INDOOR_BREATHING_RATE * indoorHours;

  const effective = volume > 0 ? dose / volume : 0;
  return { dose: round1(dose), effectivePm25: round1(effective), cigarettes: round2(effective / UG_PER_CIGARETTE) };
}

/**
 * What the recommended plan asks for, given how polluted the air and how vulnerable the household is.
 * @param {number} bandIndex
 * @param {number} riskTier
 * @returns {Scenario}
 */
export function recommendedScenario(bandIndex, riskTier) {
  return { mask: riskTier >= 3, shiftOutdoor: bandIndex >= 2, indoorUpgrade: bandIndex >= 2 };
}

/**
 * @param {number} riskTier
 * @returns {number} hours of gentle outdoor time to recommend
 */
export function outdoorHoursFor(riskTier) {
  if (riskTier >= 5) return 0.25;
  if (riskTier >= 4) return 0.5;
  return 1;
}

/**
 * @param {Lifestyle} lifestyle
 * @returns {Record<LeverId, string>}
 */
const leverLabels = (lifestyle) => ({
  mask: 'Well-fitted N95/FFP2 mask outdoors and on the commute',
  shiftOutdoor: 'Moving outdoor time to the cleanest window of the day',
  indoorUpgrade: lifestyle.hasPurifier
    ? 'Sealing windows and running your purifier'
    : 'Sealing windows and running a DIY box-fan filter',
});

/**
 * Exposure without changes, with the plan, and what each recommended change is worth on its own.
 * @param {{ airQuality: AirQuality, lifestyle: Lifestyle, risk: Risk }} input
 * @returns {Impact}
 */
export function computeImpact({ airQuality, lifestyle, risk }) {
  const rec = recommendedScenario(airQuality.band.index, risk.tier);
  /** @type {DayContext} */
  const ctx = {
    airQuality,
    lifestyle,
    outdoorHours: outdoorHoursFor(risk.tier),
    indoorRatioImproved: lifestyle.hasPurifier ? INDOOR_RATIO.purifier : INDOOR_RATIO.diyFilter,
  };

  const baseline = simulateDay(ctx, NO_CHANGES);
  const recommended = simulateDay(ctx, rec);
  const labels = leverLabels(lifestyle);

  /** @type {Lever[]} */
  const levers = LEVER_IDS.filter((id) => rec[id])
    .map((id) => {
      const saved = baseline.dose - simulateDay(ctx, { ...NO_CHANGES, [id]: true }).dose;
      return {
        id,
        label: labels[id],
        savedUg: round1(saved),
        savedPct: baseline.dose > 0 ? Math.round((saved / baseline.dose) * 100) : 0,
      };
    })
    .sort((a, b) => b.savedUg - a.savedUg);

  return {
    baseline,
    recommended,
    // The plan never adds exposure, so the reduction is clamped at 0 (which also avoids -0).
    reductionPct: Math.max(0, -pctChange(recommended.dose, baseline.dose)),
    cigarettesPerDayAvoided: round2(Math.max(0, baseline.cigarettes - recommended.cigarettes)),
    levers,
    outdoorHoursRecommended: ctx.outdoorHours,
    assumptions: { ugPerCigarette: UG_PER_CIGARETTE, maskPassThrough: MASK_PASS_THROUGH, indoorRatio: INDOOR_RATIO },
  };
}

/**
 * Compares the user's current commute with a cleaner alternative on two axes that can pull in
 * different directions: what the user themselves inhale, and what the community's air receives.
 * @param {{ airQuality: AirQuality, lifestyle: Lifestyle, riskTier: number }} input
 * @param {CommuteMode} toMode
 * @returns {CommuteSwitch}
 */
export function commuteSwitchImpact({ airQuality, lifestyle, riskTier }, toMode) {
  const from = MODES[lifestyle.commute];
  const to = MODES[toMode];
  const km = lifestyle.commuteKm;
  const co2SavedKgPerWeek = round1((from.co2PerKm - to.co2PerKm) * km * TRIPS_PER_DAY * WORKING_DAYS_PER_WEEK);
  const rushHourPm25 = mean(COMMUTE_RUSH_HOURS.map((h) => airQuality.hourly[h]));

  /**
   * @param {TravelMode} m
   * @param {boolean} maskOn
   * @returns {number} daily commute dose
   */
  const tripDose = (m, maskOn) => {
    const d = rushHourPm25 * m.ratio * m.rate * (km / m.speed) * TRIPS_PER_DAY;
    return maskOn && m.maskable ? d * MASK_PASS_THROUGH : d;
  };
  const before = tripDose(from, false);

  return {
    co2SavedKgPerWeek: Math.max(0, co2SavedKgPerWeek),
    personalInhalationChangePct: pctChange(tripDose(to, false), before),
    personalInhalationChangeMaskedPct: pctChange(tripDose(to, riskTier >= 3), before),
  };
}
