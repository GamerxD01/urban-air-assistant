/**
 * Quantifies the direct effect of daily choices.
 *
 * The model is deliberately simple and transparent: for every part of a typical day we multiply
 *   outdoor PM2.5 x (indoor/in-vehicle infiltration ratio) x (breathing rate) x (hours)
 * to get the micrograms of PM2.5 a person inhales. All constants are rounded, literature-style
 * approximations (see README "Assumptions"); outputs are illustrative, not clinical.
 */

/** Berkeley Earth rule of thumb: ~22 ug/m3 of PM2.5 over 24h is comparable to one cigarette/day. */
export const UG_PER_CIGARETTE = 22;
const WORKING_DAYS_PER_WEEK = 5;
const COMMUTE_RUSH_HOURS = [9, 18];
const BASELINE_LEISURE_HOUR = 7; // the classic "morning walk" slot
const LEISURE_BREATHING_RATE = 1.3;
const INDOOR_BREATHING_RATE = 0.5;

/** speed km/h, breathing rate m3/h, infiltration ratio vs outdoor air, tailpipe kg CO2 per passenger-km. */
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

/** Share of PM2.5 still inhaled through a well-fitted N95/FFP2 respirator (real-world, not lab). */
const MASK_PASS_THROUGH = 0.2;

const INDOOR_RATIO_TYPICAL = 0.85; // windows opened now and then
const INDOOR_RATIO_SEALED_DIY = 0.55; // windows shut + DIY box-fan filter
const INDOOR_RATIO_SEALED_PURIFIER = 0.35; // windows shut + HEPA purifier running

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Plan describing one day.
 * @typedef {{ mask: boolean, shiftOutdoor: boolean, indoorUpgrade: boolean }} Scenario
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
  const indoorHours = Math.max(0, 24 - 2 * tripHours - leisureHours);
  const indoorRatio = scenario.indoorUpgrade ? indoorRatioImproved : INDOOR_RATIO_TYPICAL;
  dose += pm25 * indoorRatio * INDOOR_BREATHING_RATE * indoorHours;
  volume += INDOOR_BREATHING_RATE * indoorHours;

  const effective = volume > 0 ? dose / volume : 0;
  return {
    dose: round1(dose),
    effectivePm25: round1(effective),
    cigarettes: round2(effective / UG_PER_CIGARETTE),
  };
}

/** What the recommended plan asks for, given how polluted the air and how vulnerable the household is. */
export function recommendedScenario(bandIndex, riskTier) {
  return {
    mask: riskTier >= 3,
    shiftOutdoor: bandIndex >= 2,
    indoorUpgrade: bandIndex >= 2,
  };
}

export function outdoorHoursFor(riskTier) {
  if (riskTier >= 5) return 0.25;
  if (riskTier >= 4) return 0.5;
  return 1;
}

export function computeImpact({ airQuality, lifestyle, risk }) {
  const bandIndex = airQuality.band.index;
  const rec = recommendedScenario(bandIndex, risk.tier);
  const ctx = {
    airQuality,
    lifestyle,
    outdoorHours: outdoorHoursFor(risk.tier),
    indoorRatioImproved: lifestyle.hasPurifier ? INDOOR_RATIO_SEALED_PURIFIER : INDOOR_RATIO_SEALED_DIY,
  };

  const none = { mask: false, shiftOutdoor: false, indoorUpgrade: false };
  const baseline = simulateDay(ctx, none);
  const recommended = simulateDay(ctx, rec);

  const levers = [];
  const labels = {
    mask: 'Well-fitted N95/FFP2 mask outdoors and on the commute',
    shiftOutdoor: 'Moving outdoor time to the cleanest window of the day',
    indoorUpgrade: lifestyle.hasPurifier
      ? 'Sealing windows and running your purifier'
      : 'Sealing windows and running a DIY box-fan filter',
  };
  for (const key of Object.keys(none)) {
    if (!rec[key]) continue;
    const solo = simulateDay(ctx, { ...none, [key]: true });
    const saved = baseline.dose - solo.dose;
    levers.push({
      id: key,
      label: labels[key],
      savedUg: round1(saved),
      savedPct: baseline.dose > 0 ? Math.round((saved / baseline.dose) * 100) : 0,
    });
  }
  levers.sort((a, b) => b.savedUg - a.savedUg);

  const reductionPct = baseline.dose > 0 ? Math.round(((baseline.dose - recommended.dose) / baseline.dose) * 100) : 0;

  return {
    baseline,
    recommended,
    reductionPct,
    cigarettesPerDayAvoided: round2(Math.max(0, baseline.cigarettes - recommended.cigarettes)),
    levers,
    outdoorHoursRecommended: ctx.outdoorHours,
    assumptions: {
      ugPerCigarette: UG_PER_CIGARETTE,
      maskPassThrough: MASK_PASS_THROUGH,
      indoorRatio: {
        typical: INDOOR_RATIO_TYPICAL,
        diyFilter: INDOOR_RATIO_SEALED_DIY,
        purifier: INDOOR_RATIO_SEALED_PURIFIER,
      },
    },
  };
}

/**
 * Compares the user's current commute with a cleaner alternative on two axes that can pull in
 * different directions: what the user themselves inhale, and what the community's air receives.
 */
export function commuteSwitchImpact({ airQuality, lifestyle, riskTier }, toMode) {
  const from = MODES[lifestyle.commute];
  const to = MODES[toMode];
  const km = lifestyle.commuteKm;
  const co2SavedKgPerWeek = round1((from.co2PerKm - to.co2PerKm) * km * 2 * WORKING_DAYS_PER_WEEK);

  const trip = (m, maskOn) => {
    const hours = km / m.speed;
    const conc = mean(COMMUTE_RUSH_HOURS.map((h) => airQuality.hourly[h]));
    const d = conc * m.ratio * m.rate * hours * 2;
    return maskOn && m.maskable ? d * MASK_PASS_THROUGH : d;
  };
  const before = trip(from, false);
  const afterNoMask = trip(to, false);
  const afterMasked = trip(to, riskTier >= 3);
  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);

  return {
    co2SavedKgPerWeek: Math.max(0, co2SavedKgPerWeek),
    personalInhalationChangePct: pct(afterNoMask, before),
    personalInhalationChangeMaskedPct: pct(afterMasked, before),
  };
}
