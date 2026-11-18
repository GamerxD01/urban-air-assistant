import { sensitiveGroups } from './profile.js';

const TIERS = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'low', label: 'Low' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'high', label: 'High' },
  { id: 'very_high', label: 'Very high' },
  { id: 'severe', label: 'Severe' },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Household risk = how bad the air is, raised by how vulnerable or exposed the household is.
 * The uplift is capped (and reduced when air is only mildly polluted) so that clean air never
 * produces alarming advice and a very sick household never jumps more than two tiers.
 */
export function assessRisk(bandIndex, household) {
  let uplift = 0;
  if (household.respiratory) uplift += 2;
  if (household.children) uplift += 1;
  if (household.elderly) uplift += 1;
  if (household.pregnant) uplift += 1;
  if (household.outdoorWorker) uplift += 1;

  const cap = bandIndex >= 2 ? 2 : bandIndex === 1 ? 1 : 0;
  const applied = Math.min(uplift, cap);
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
