/**
 * Household risk: how bad the air is, raised by how vulnerable or exposed the household is.
 * @module engine/risk
 */
import { clamp } from './math.js';
import { sensitiveGroups } from './profile.js';

/** @typedef {import('../types.js').Household} Household */
/** @typedef {import('../types.js').Risk} Risk */

const TIERS = Object.freeze([
  { id: 'minimal', label: 'Minimal' },
  { id: 'low', label: 'Low' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'high', label: 'High' },
  { id: 'very_high', label: 'Very high' },
  { id: 'severe', label: 'Severe' },
]);

/** Tiers each vulnerability adds before the cap. Respiratory and heart conditions count double. */
const UPLIFT = Object.freeze({ respiratory: 2, children: 1, elderly: 1, pregnant: 1, outdoorWorker: 1 });
/** Maximum uplift by air band: none on clean days, one when satisfactory, two otherwise. */
const MAX_UPLIFT_BY_BAND = Object.freeze([0, 1, 2, 2, 2, 2]);

/**
 * The uplift is capped (and reduced when air is only mildly polluted) so that clean air never
 * produces alarming advice and a very sick household never jumps more than two tiers.
 * @param {number} bandIndex CPCB band 0-5
 * @param {Household} household
 * @returns {Risk}
 */
export function assessRisk(bandIndex, household) {
  const uplift = Object.entries(UPLIFT).reduce(
    (sum, [key, tiers]) => sum + (household[/** @type {keyof Household} */ (key)] ? tiers : 0),
    0,
  );
  const applied = Math.min(uplift, MAX_UPLIFT_BY_BAND[bandIndex] ?? 0);
  const tier = clamp(bandIndex + applied, 0, TIERS.length - 1);
  const groups = sensitiveGroups(household);

  return {
    tier,
    id: TIERS[tier].id,
    label: TIERS[tier].label,
    uplift: applied,
    sensitiveGroups: groups,
    reasons: [
      `Outdoor air sits in band ${bandIndex} on a 0-5 scale (0 = good, 5 = severe).`,
      ...(applied > 0
        ? [`Raised by ${applied} tier${applied > 1 ? 's' : ''} because the household includes ${groups.join(', ')}.`]
        : []),
    ],
  };
}
