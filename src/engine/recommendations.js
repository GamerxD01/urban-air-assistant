import { commuteSwitchImpact, MODES } from './impact.js';

const fmtHour = (h) => {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh >= 12 ? 'pm' : 'am';
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}${suffix}`;
};
export const fmtWindow = (w) => `${fmtHour(w.start)}-${fmtHour(w.end)}`;

/** Each item: { id, title, detail, why, tag, when? } - `why` always explains the direct effect of the choice. */

export function buildRoutine({ airQuality, risk, profile, impact }) {
  const { band, bestWindow, worstWindow } = airQuality;
  const { household, lifestyle } = profile;
  const items = [];
  const sensitive = risk.sensitiveGroups.length > 0;

  if (band.index <= 1 && risk.tier <= 1) {
    items.push({
      id: 'normal-day',
      when: 'All day',
      title: 'Go about your day normally',
      detail: `Air is ${band.label.toLowerCase()} (AQI ${airQuality.aqi}). Outdoor play, walks and open windows are fine.`,
      why: 'At this level the health effect of outdoor exposure is small for most people.',
      tag: 'outdoors',
    });
    return items;
  }

  items.push({
    id: 'outdoor-window',
      when: fmtWindow(bestWindow),
    title: `Do outdoor time at ${fmtWindow(bestWindow)}`,
    detail: `This is today's cleanest daylight window (about ${bestWindow.avg} µg/m³ PM2.5). Keep it to ${impact.outdoorHoursRecommended >= 1 ? '1 hour' : `${Math.round(impact.outdoorHoursRecommended * 60)} minutes`} and keep it gentle.`,
    why: `Air at ${fmtWindow(worstWindow)} is about ${Math.round((worstWindow.avg / bestWindow.avg - 1) * 100)}% dirtier, so the same walk delivers that much more pollution to your lungs.`,
    tag: 'outdoors',
  });

  if (band.index >= 2) {
    items.push({
      id: 'avoid-peak',
      when: fmtWindow(worstWindow),
      title: `Stay indoors at ${fmtWindow(worstWindow)}`,
      detail: 'Cold air traps smoke and exhaust close to the ground at night and in the early morning.',
      why: 'Move school drop-offs, jogging and vegetable shopping out of this slot where you can.',
      tag: 'outdoors',
    });
  }

  if (household.children || risk.tier >= 4) {
    items.push({
      id: 'kids-play',
      when: 'All day',
      title: household.children ? 'Keep children\'s active play indoors on bad-air days' : 'Swap hard exercise for indoor activity',
      detail: 'Skipping outdoor sports and PE-style play is the single most protective step when AQI is very poor or worse.',
      why: 'Running multiplies breathing rate by 2-3x, so a short sprint outside can inhale as much smog as hours of sitting.',
      tag: 'outdoors',
    });
  }

  if (risk.tier >= 3) {
    const onCommute = MODES[lifestyle.commute].maskable && lifestyle.commute !== 'work_from_home' ? ' and on your commute' : '';
    items.push({
      id: 'mask',
      when: 'Whenever outside',
      title: `Wear a well-fitted N95/FFP2 mask outdoors${onCommute}`,
      detail: 'Cloth and surgical masks barely stop PM2.5. Pick a respirator with no gaps and replace it when it is damp or soiled.',
      why: 'A properly fitted respirator typically cuts the PM2.5 you breathe in by about 80%.',
      tag: 'protection',
    });
  }

  if (household.respiratory) {
    items.push({
      id: 'medical',
      when: 'If symptoms appear',
      title: 'Keep reliever medication to hand and follow the care plan',
      detail: 'If breathlessness, wheeze or chest tightness increases, contact your doctor rather than waiting for the air to clear.',
      why: 'People with asthma, COPD or heart disease are the first to be hurt by smog spikes.',
      tag: 'protection',
    });
  }

  if (household.pregnant || household.elderly) {
    items.push({
      id: 'vulnerable',
      when: 'All day',
      title: 'Limit non-essential trips and use indoor exercise',
      detail: 'Prefer indoor stretching, yoga or corridor walks over street walks while air is this poor.',
      why: 'Pregnancy and older age both make the body less able to cope with fine particles.',
      tag: 'protection',
    });
  }

  if (household.outdoorWorker && band.index >= 3) {
    items.push({
      id: 'outdoor-work',
      when: fmtWindow(bestWindow),
      title: 'Use a respirator and schedule heavy work in the cleanest window',
      detail: `Do physical tasks around ${fmtWindow(bestWindow)} and take breaks indoors with filtered air.`,
      why: 'Heavy work multiplies breathing rate, which multiplies the pollution that reaches the lungs.',
      tag: 'protection',
    });
  }

  if (sensitive && band.index >= 4) {
    items.push({
      id: 'schedule-flex',
      when: 'Worst days',
      title: 'Ask school or work for flexibility on the worst days',
      detail: 'Remote work, indoor assemblies or a later start can all take people off the road in the peak hours.',
      why: 'Avoiding the morning peak is one of the cheapest exposure cuts available.',
      tag: 'protection',
    });
  }

  return items;
}

export function buildIndoorHacks({ airQuality, risk, profile }) {
  const { band } = airQuality;
  const { lifestyle } = profile;
  const hacks = [];

  if (band.index <= 1) {
    hacks.push({
      id: 'ventilate',
      title: 'Ventilate freely',
      detail: 'Open windows for cross-ventilation while the air is clean.',
      why: 'Fresh air dilutes indoor cooking fumes, CO2 and moisture.',
      tag: 'indoor',
    });
    return hacks;
  }

  hacks.push({
    id: 'seal',
    title: 'Keep windows shut in the dirty hours and seal gaps',
    detail: `Ventilate briefly (10 minutes) at ${fmtWindow(airQuality.bestWindow)} when outdoor air is cleanest, then close up. Use door draught-stoppers or damp towels on gaps.`,
    why: 'Sealing keeps more of the outdoor smog out and lowers indoor PM2.5 meaningfully.',
    tag: 'indoor',
  });

  if (lifestyle.hasPurifier) {
    hacks.push({
      id: 'purifier',
      title: 'Run your purifier on high in the room where people sleep',
      detail: 'Close the door, run it from the evening, and replace the filter on schedule.',
      why: 'A HEPA purifier in a closed bedroom can cut indoor PM2.5 by well over half.',
      tag: 'indoor',
    });
  } else {
    hacks.push({
      id: 'diy-filter',
      title: 'Build a ~Rs 1,500 box-fan air filter (Corsi-Rosenthal box)',
      detail: 'Tape four HVAC/MERV 13 filters into a cube around a 20-inch box fan. Run it on low in the main living space.',
      why: 'This does a purifier\'s job for a fraction of the price and is documented to clean a room quickly.',
      tag: 'indoor',
    });
  }

  if (lifestyle.cooking === 'biomass' || lifestyle.cooking === 'lpg') {
    hacks.push({
      id: 'kitchen',
      title: 'Switch on the chimney or exhaust fan before you cook',
      detail: lifestyle.cooking === 'biomass'
        ? 'Cook outdoors or in a well-ventilated space and keep children out of the kitchen.'
        : 'Keep the burner blue, ventilate while cooking and for 10 minutes after.',
      why: 'Cooking is often the largest indoor source of fine particles.',
      tag: 'indoor',
    });
  }

  if (lifestyle.heating === 'wood_coal') {
    hacks.push({
      id: 'heating',
      title: 'Replace open wood/coal burning with an electric heater or layers',
      detail: 'Warm clothes, a hot-water bottle and a heated blanket do most of the job at a fraction of the smoke.',
      why: 'Burning wood or coal indoors can push indoor PM2.5 higher than the street outside.',
      tag: 'indoor',
    });
  }

  hacks.push({
    id: 'clean-dust',
    title: 'Wet-mop and damp-wipe instead of dry sweeping',
    detail: 'Dry brooms re-suspend the settled dust and smoke particles.',
    why: 'Wet cleaning removes particles from the room instead of moving them around.',
    tag: 'indoor',
  });

  if (band.index >= 3) {
    hacks.push({
      id: 'no-smoke',
      title: 'No incense, candles, mosquito coils or smoking indoors',
      detail: 'Each burns and releases fine particles directly into your breathing air.',
      why: 'On a smoggy day your indoor air is your safe zone, so protect it.',
      tag: 'indoor',
    });
    hacks.push({
      id: 'plants',
      title: 'Treat houseplants as a bonus, not a filter',
      detail: 'They are nice to have but do not meaningfully clean indoor PM2.5 at home scale.',
      why: 'Honest note: airflow through a filter does far more than plants do.',
      tag: 'indoor',
    });
  }

  return hacks;
}

const SWITCHES = {
  car: [['public_transport', 'Take the metro or bus'], ['carpool', 'Carpool with a colleague or neighbour']],
  two_wheeler: [['public_transport', 'Take the metro or bus (and mask up while waiting)'], ['cycle', 'Cycle if your trip is short and traffic is light']],
  public_transport: [['walk', 'Walk the first/last mile at the cleanest hour']],
  walk: [],
  cycle: [],
  work_from_home: [],
};

export function buildSustainable({ airQuality, risk, profile }) {
  const { lifestyle } = profile;
  const picks = [];
  const ctx = { airQuality, lifestyle, riskTier: risk.tier };

  const options = SWITCHES[lifestyle.commute] ?? [];
  for (const [mode, title] of options) {
    if (mode === 'cycle' && (lifestyle.commuteKm > 8 || risk.tier >= 4)) continue; // cycling is a bad idea on severe days
    const impact = commuteSwitchImpact(ctx, mode);
    if (impact.co2SavedKgPerWeek <= 0) continue;
    const personal = impact.personalInhalationChangeMaskedPct;
    const personalNote = personal === 0
      ? 'your own exposure stays the same'
      : personal < 0
      ? `your own PM2.5 intake on the commute also drops ${Math.abs(personal)}%${impact.personalInhalationChangeMaskedPct !== impact.personalInhalationChangePct ? ' (with a mask)' : ''}`
      : `your own commute intake rises ${personal}% (more time outdoors), so pair it with a mask and avoid peak hours`;
    picks.push({
      id: `switch-${mode}`,
      title,
      detail: `About ${lifestyle.commuteKm} km each way, ${personalNote}.`,
      why: `Saves roughly ${impact.co2SavedKgPerWeek} kg of CO2 per week and takes a vehicle off the street.`,
      tag: 'community',
      impact,
    });
  }

  if (lifestyle.cooking === 'biomass') {
    picks.push({
      id: 'clean-cooking',
      title: 'Move to LPG, PNG or induction cooking',
      detail: 'Government LPG schemes (e.g. PM Ujjwala) and subsidised induction programmes may help.',
      why: 'Clean cooking can remove the biggest source of indoor fine particles, especially for women and children.',
      tag: 'community',
    });
  }

  if (lifestyle.heating === 'wood_coal') {
    picks.push({
      id: 'clean-heat',
      title: 'Use electric or gas heating instead of burning wood and coal',
      detail: 'Neighbours who stop burning leaves help the whole street breathe.',
      why: 'Local winter burning is a significant contributor to neighbourhood smog.',
      tag: 'community',
    });
  }

  picks.push(
    {
      id: 'no-burning',
      title: 'Never burn leaves, waste or garbage - and report it',
      detail: 'Use your city\'s pollution-complaint app or helpline, and organise a composting drive.',
      why: 'Open burning pushes dense smoke straight into the neighbourhood.',
      tag: 'community',
    },
    {
      id: 'idle-off',
      title: 'Switch the engine off at red lights and while waiting',
      detail: 'Even 30 seconds of idling burns fuel for no distance.',
      why: 'It lowers fumes in school zones and cuts fuel costs.',
      tag: 'community',
    },
    {
      id: 'school-community',
      title: 'Start a school or RWA clean-air group',
      detail: 'Share the daily AQI, agree on no-idling zones near school gates and run anti-burning drives.',
      why: 'Community action changes what the entire street breathes, not just your household.',
      tag: 'community',
    },
  );

  return picks;
}
