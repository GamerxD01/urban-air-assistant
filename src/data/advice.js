/**
 * The assistant's advice copy, kept as data so wording can be reviewed, edited or translated
 * without touching decision logic. `{name}` placeholders are filled by engine/template.js;
 * a missing value throws, so a typo can never ship as a literal "{best}".
 *
 * Which entries a household sees is decided in engine/recommendations.js.
 * @module data/advice
 */

/**
 * @typedef {object} AdviceTemplate
 * @property {string} id stable id the UI and tests rely on
 * @property {'outdoors' | 'protection' | 'indoor' | 'community'} tag
 * @property {string} title
 * @property {string} [detail]
 * @property {string} why
 * @property {string} [when]
 */

/** @type {Readonly<Record<string, AdviceTemplate>>} */
export const ROUTINE_ADVICE = Object.freeze({
  normalDay: {
    id: 'normal-day',
    tag: 'outdoors',
    when: 'All day',
    title: 'Go about your day normally',
    detail: 'Air is {band} (AQI {aqi}). Outdoor play, walks and open windows are fine.',
    why: 'At this level the health effect of outdoor exposure is small for most people.',
  },
  outdoorWindow: {
    id: 'outdoor-window',
    tag: 'outdoors',
    when: '{best}',
    title: 'Do outdoor time at {best}',
    detail:
      "This is today's cleanest daylight window (about {bestAvg} µg/m³ PM2.5). Keep it to {outdoorDuration} and keep it gentle.",
    why: 'Air at {worst} is about {pctDirtier}% dirtier, so the same walk delivers that much more pollution to your lungs.',
  },
  avoidPeak: {
    id: 'avoid-peak',
    tag: 'outdoors',
    when: '{worst}',
    title: 'Stay indoors at {worst}',
    detail: 'Cold air traps smoke and exhaust close to the ground at night and in the early morning.',
    why: 'Move school drop-offs, jogging and vegetable shopping out of this slot where you can.',
  },
  kidsPlay: {
    id: 'kids-play',
    tag: 'outdoors',
    when: 'All day',
    title: "Keep children's active play indoors on bad-air days",
    detail:
      'Skipping outdoor sports and PE-style play is the single most protective step when AQI is very poor or worse.',
    why: 'Running multiplies breathing rate by 2-3x, so a short sprint outside can inhale as much smog as hours of sitting.',
  },
  hardExercise: {
    id: 'kids-play',
    tag: 'outdoors',
    when: 'All day',
    title: 'Swap hard exercise for indoor activity',
    detail:
      'Skipping outdoor sports and hard exercise is the single most protective step when AQI is very poor or worse.',
    why: 'Running multiplies breathing rate by 2-3x, so a short sprint outside can inhale as much smog as hours of sitting.',
  },
  mask: {
    id: 'mask',
    tag: 'protection',
    when: 'Whenever outside',
    title: 'Wear a well-fitted N95/FFP2 mask outdoors{onCommute}',
    detail:
      'Cloth and surgical masks barely stop PM2.5. Pick a respirator with no gaps and replace it when it is damp or soiled.',
    why: 'A properly fitted respirator typically cuts the PM2.5 you breathe in by about 80%.',
  },
  medical: {
    id: 'medical',
    tag: 'protection',
    when: 'If symptoms appear',
    title: 'Keep reliever medication to hand and follow the care plan',
    detail:
      'If breathlessness, wheeze or chest tightness increases, contact your doctor rather than waiting for the air to clear.',
    why: 'People with asthma, COPD or heart disease are the first to be hurt by smog spikes.',
  },
  vulnerable: {
    id: 'vulnerable',
    tag: 'protection',
    when: 'All day',
    title: 'Limit non-essential trips and use indoor exercise',
    detail: 'Prefer indoor stretching, yoga or corridor walks over street walks while air is this poor.',
    why: 'Pregnancy and older age both make the body less able to cope with fine particles.',
  },
  outdoorWork: {
    id: 'outdoor-work',
    tag: 'protection',
    when: '{best}',
    title: 'Use a respirator and schedule heavy work in the cleanest window',
    detail: 'Do physical tasks around {best} and take breaks indoors with filtered air.',
    why: 'Heavy work multiplies breathing rate, which multiplies the pollution that reaches the lungs.',
  },
  scheduleFlex: {
    id: 'schedule-flex',
    tag: 'protection',
    when: 'Worst days',
    title: 'Ask school or work for flexibility on the worst days',
    detail: 'Remote work, indoor assemblies or a later start can all take people off the road in the peak hours.',
    why: 'Avoiding the morning peak is one of the cheapest exposure cuts available.',
  },
});

/** @type {Readonly<Record<string, AdviceTemplate>>} */
export const INDOOR_ADVICE = Object.freeze({
  ventilate: {
    id: 'ventilate',
    tag: 'indoor',
    title: 'Ventilate freely',
    detail: 'Open windows for cross-ventilation while the air is clean.',
    why: 'Fresh air dilutes indoor cooking fumes, CO2 and moisture.',
  },
  seal: {
    id: 'seal',
    tag: 'indoor',
    title: 'Keep windows shut in the dirty hours and seal gaps',
    detail:
      'Ventilate briefly (10 minutes) at {best} when outdoor air is cleanest, then close up. Use door draught-stoppers or damp towels on gaps.',
    why: 'Sealing keeps more of the outdoor smog out and lowers indoor PM2.5 meaningfully.',
  },
  purifier: {
    id: 'purifier',
    tag: 'indoor',
    title: 'Run your purifier on high in the room where people sleep',
    detail: 'Close the door, run it from the evening, and replace the filter on schedule.',
    why: 'A HEPA purifier in a closed bedroom can cut indoor PM2.5 by well over half.',
  },
  diyFilter: {
    id: 'diy-filter',
    tag: 'indoor',
    title: 'Build a ~Rs 1,500 box-fan air filter (Corsi-Rosenthal box)',
    detail:
      'Tape four HVAC/MERV 13 filters into a cube around a 20-inch box fan. Run it on low in the main living space.',
    why: "This does a purifier's job for a fraction of the price and is documented to clean a room quickly.",
  },
  kitchenBiomass: {
    id: 'kitchen',
    tag: 'indoor',
    title: 'Switch on the chimney or exhaust fan before you cook',
    detail: 'Cook outdoors or in a well-ventilated space and keep children out of the kitchen.',
    why: 'Cooking is often the largest indoor source of fine particles.',
  },
  kitchenGas: {
    id: 'kitchen',
    tag: 'indoor',
    title: 'Switch on the chimney or exhaust fan before you cook',
    detail: 'Keep the burner blue, ventilate while cooking and for 10 minutes after.',
    why: 'Cooking is often the largest indoor source of fine particles.',
  },
  heating: {
    id: 'heating',
    tag: 'indoor',
    title: 'Replace open wood/coal burning with an electric heater or layers',
    detail: 'Warm clothes, a hot-water bottle and a heated blanket do most of the job at a fraction of the smoke.',
    why: 'Burning wood or coal indoors can push indoor PM2.5 higher than the street outside.',
  },
  cleanDust: {
    id: 'clean-dust',
    tag: 'indoor',
    title: 'Wet-mop and damp-wipe instead of dry sweeping',
    detail: 'Dry brooms re-suspend the settled dust and smoke particles.',
    why: 'Wet cleaning removes particles from the room instead of moving them around.',
  },
  noSmoke: {
    id: 'no-smoke',
    tag: 'indoor',
    title: 'No incense, candles, mosquito coils or smoking indoors',
    detail: 'Each burns and releases fine particles directly into your breathing air.',
    why: 'On a smoggy day your indoor air is your safe zone, so protect it.',
  },
  plants: {
    id: 'plants',
    tag: 'indoor',
    title: 'Treat houseplants as a bonus, not a filter',
    detail: 'They are nice to have but do not meaningfully clean indoor PM2.5 at home scale.',
    why: 'Honest note: airflow through a filter does far more than plants do.',
  },
});

/** @type {Readonly<Record<string, AdviceTemplate>>} */
export const COMMUNITY_ADVICE = Object.freeze({
  commuteSwitch: {
    id: 'switch-{mode}',
    tag: 'community',
    title: '{switchTitle}',
    detail: 'About {km} km each way, {personalNote}.',
    why: 'Saves roughly {co2} kg of CO2 per week and takes a vehicle off the street.',
  },
  cleanCooking: {
    id: 'clean-cooking',
    tag: 'community',
    title: 'Move to LPG, PNG or induction cooking',
    detail: 'Government LPG schemes (e.g. PM Ujjwala) and subsidised induction programmes may help.',
    why: 'Clean cooking can remove the biggest source of indoor fine particles, especially for women and children.',
  },
  cleanHeat: {
    id: 'clean-heat',
    tag: 'community',
    title: 'Use electric or gas heating instead of burning wood and coal',
    detail: 'Neighbours who stop burning leaves help the whole street breathe.',
    why: 'Local winter burning is a significant contributor to neighbourhood smog.',
  },
  noBurning: {
    id: 'no-burning',
    tag: 'community',
    title: 'Never burn leaves, waste or garbage - and report it',
    detail: "Use your city's pollution-complaint app or helpline, and organise a composting drive.",
    why: 'Open burning pushes dense smoke straight into the neighbourhood.',
  },
  idleOff: {
    id: 'idle-off',
    tag: 'community',
    title: 'Switch the engine off at red lights and while waiting',
    detail: 'Even 30 seconds of idling burns fuel for no distance.',
    why: 'It lowers fumes in school zones and cuts fuel costs.',
  },
  schoolGroup: {
    id: 'school-community',
    tag: 'community',
    title: 'Start a school or RWA clean-air group',
    detail: 'Share the daily AQI, agree on no-idling zones near school gates and run anti-burning drives.',
    why: 'Community action changes what the entire street breathes, not just your household.',
  },
});

/**
 * Cleaner commute options per current mode, with the wording shown to the user.
 * @type {Readonly<Record<import('../types.js').CommuteMode, readonly { mode: import('../types.js').CommuteMode, title: string }[]>>}
 */
export const COMMUTE_SWITCHES = Object.freeze({
  car: [
    { mode: 'public_transport', title: 'Take the metro or bus' },
    { mode: 'carpool', title: 'Carpool with a colleague or neighbour' },
  ],
  two_wheeler: [
    { mode: 'public_transport', title: 'Take the metro or bus (and mask up while waiting)' },
    { mode: 'cycle', title: 'Cycle if your trip is short and traffic is light' },
  ],
  public_transport: [{ mode: 'walk', title: 'Walk the first/last mile at the cleanest hour' }],
  walk: [],
  cycle: [],
  carpool: [],
  work_from_home: [],
});

/** How a commute switch changes the user's own exposure, by direction. */
export const PERSONAL_EXPOSURE_NOTES = Object.freeze({
  same: 'your own exposure stays the same',
  lower: 'your own PM2.5 intake on the commute also drops {pct}%{maskNote}',
  higher: 'your own commute intake rises {pct}% (more time outdoors), so pair it with a mask and avoid peak hours',
});
