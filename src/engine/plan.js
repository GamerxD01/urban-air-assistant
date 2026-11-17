import { normalizeAirQuality } from './aqi.js';
import { normalizeProfile } from './profile.js';
import { assessRisk } from './risk.js';
import { computeImpact } from './impact.js';
import { buildRoutine, buildIndoorHacks, buildSustainable, fmtWindow } from './recommendations.js';

const HEADLINES = [
  'Air is clean - enjoy your day.',
  'Air is acceptable for most people.',
  'Air is unhealthy for sensitive groups - plan your day around the clean window.',
  'Air is poor - cut exposure where you can.',
  'Air is very poor - treat today as a protect-yourself day.',
  'Air is severe - minimise time outdoors today.',
];

/**
 * Pure, deterministic function: (air quality, profile) -> structured plan.
 * This is the factual backbone; the GenAI layer only rewrites and explains it.
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
    summary: summarize(airQuality, risk, impact),
    routine: buildRoutine(ctx),
    indoor: buildIndoorHacks(ctx),
    sustainable: buildSustainable(ctx),
    impact,
    profile,
    profileWarnings: errors,
    disclaimer:
      'General wellbeing guidance, not medical advice. If you or a family member has breathing difficulty, chest pain or dizziness, contact a doctor.',
  };
}

function summarize(air, risk, impact) {
  const where = air.location?.name ? ` in ${air.location.name}` : '';
  const base = `PM2.5 averages ${air.pm25} µg/m³${where} (AQI ${air.aqi}, ${air.band.label}).`;
  if (impact.reductionPct <= 0) return `${base} No extra precautions are needed.`;
  return `${base} Following this plan cuts your estimated PM2.5 intake by about ${impact.reductionPct}%, equal to avoiding ${impact.cigarettesPerDayAvoided} cigarettes' worth of smoke a day. Cleanest outdoor window: ${fmtWindow(air.bestWindow)}.`;
}
