/**
 * Assembles the full plan: the deterministic, factual backbone that the GenAI layer explains.
 * @module engine/plan
 */
import { normalizeAirQuality } from './aqi.js';
import { computeImpact } from './impact.js';
import { normalizeProfile } from './profile.js';
import { buildIndoorHacks, buildRoutine, buildSustainable, fmtWindow } from './recommendations.js';
import { assessRisk } from './risk.js';

/** @typedef {import('../types.js').Plan} Plan */
/** @typedef {import('../types.js').AirQuality} AirQuality */
/** @typedef {import('../types.js').Impact} Impact */

/** One line per household risk tier (not air band): it reflects air quality and who lives in the home. */
const HEADLINES = Object.freeze([
  'Low risk for your household today. Enjoy your day.',
  'Low risk for your household today.',
  'Moderate risk for your household. Plan your day around the clean window.',
  'High risk for your household. Cut exposure where you can.',
  'Very high risk for your household. Treat today as a protect-yourself day.',
  'Severe risk for your household. Keep time outdoors to a minimum.',
]);

const DISCLAIMER =
  'General wellbeing guidance, not medical advice. If you or a family member has breathing difficulty, chest pain or dizziness, contact a doctor.';

/**
 * Pure, deterministic function: (air quality, profile) -> structured plan.
 * @param {{ airQuality: import('../types.js').AirQualityInput, profile?: unknown }} input
 * @returns {Plan}
 * @throws {TypeError} when air quality inputs are unusable
 */
export function buildPlan({ airQuality: rawAir, profile: rawProfile }) {
  const airQuality = normalizeAirQuality(rawAir);
  const { value: profile, errors } = normalizeProfile(rawProfile);
  const risk = assessRisk(airQuality.band.index, profile.household);
  const impact = computeImpact({ airQuality, lifestyle: profile.lifestyle, risk });
  const ctx = { airQuality, risk, profile, impact };

  return {
    generatedFor: new Date().toISOString().slice(0, 10),
    airQuality,
    risk,
    headline: HEADLINES[risk.tier],
    summary: summarize(airQuality, impact),
    routine: buildRoutine(ctx),
    indoor: buildIndoorHacks(ctx),
    sustainable: buildSustainable(ctx),
    impact,
    profile,
    profileWarnings: errors,
    disclaimer: DISCLAIMER,
  };
}

/**
 * @param {AirQuality} air
 * @param {Impact} impact
 * @returns {string}
 */
function summarize(air, impact) {
  const where = air.location?.name ? ` in ${air.location.name}` : '';
  const base = `PM2.5 averages ${air.pm25} µg/m³${where} (AQI ${air.aqi}, ${air.band.label}).`;
  if (impact.reductionPct <= 0) return `${base} No extra precautions are needed.`;
  return `${base} Following this plan cuts your estimated PM2.5 intake by about ${impact.reductionPct}%, equal to avoiding ${impact.cigarettesPerDayAvoided} cigarettes' worth of smoke a day. Cleanest outdoor window: ${fmtWindow(air.bestWindow)}.`;
}
