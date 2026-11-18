/**
 * Offline narrator used when Gemini is not configured or does not answer in time.
 * It only rephrases the plan, so it is always consistent with the numbers on screen.
 * @module services/ruleNarrator
 */

/** @typedef {import('../types.js').Plan} Plan */
/** @typedef {import('../types.js').Item} Item */

/**
 * A short briefing built from the plan's own figures.
 * @param {Plan} plan
 * @returns {string}
 */
export function ruleNarration(plan) {
  const { airQuality, impact, risk } = plan;
  const where = airQuality.location?.name ? ` in ${airQuality.location.name}` : '';
  const band = airQuality.band.label.toLowerCase();
  const top = impact.levers[0];
  if (!top) {
    return `Air quality${where} is ${band} today (AQI ${airQuality.aqi}), so no special precautions are needed. Enjoy outdoor time, and consider joining a community clean-air group to keep it that way.`;
  }
  const groups = risk.sensitiveGroups.length
    ? ` Your household includes ${risk.sensitiveGroups.join(' and ')}, so we take extra care.`
    : '';
  const action = `${top.label.charAt(0).toLowerCase()}${top.label.slice(1)}`;
  return `Air${where} is ${band} today (AQI ${airQuality.aqi}).${groups} Your biggest single win: ${action}, which alone cuts your exposure by about ${top.savedPct}%. Together, this plan lowers your PM2.5 intake by about ${impact.reductionPct}%. For the community, help stop open burning and idling near schools.`;
}

/**
 * @typedef {object} Topic
 * @property {RegExp} pattern words that signal the topic
 * @property {(plan: Plan) => Item | undefined} pick the plan item that answers it, if any
 * @property {string} fallback general answer when the plan has no matching item
 */

/** @type {readonly Topic[]} */
const TOPICS = Object.freeze([
  {
    pattern: /\b(mask|n95|ffp2|respirator)\b/i,
    pick: (p) => p.routine.find((r) => r.id === 'mask'),
    fallback: 'A well-fitted N95/FFP2 respirator is the mask that works; cloth and surgical masks barely stop PM2.5.',
  },
  {
    pattern: /\b(purifier|filter|hepa|diy|fan)\b/i,
    pick: (p) => p.indoor.find((r) => r.id === 'purifier' || r.id === 'diy-filter'),
    fallback: 'Keep windows closed in the dirty hours and run a purifier or a box-fan filter in the room you use most.',
  },
  {
    pattern: /\b(window|ventilat|air out|open)\b/i,
    pick: (p) => p.indoor.find((r) => r.id === 'seal' || r.id === 'ventilate'),
    fallback: 'Open windows briefly at the cleanest time of day, then close them.',
  },
  {
    pattern: /\b(walk|jog|run|exercise|outside|outdoor|play|school)\b/i,
    pick: (p) => p.routine.find((r) => r.id === 'outdoor-window' || r.id === 'normal-day'),
    fallback: 'Choose the cleanest window of the day for outdoor time and keep it gentle.',
  },
  {
    pattern: /\b(cook|kitchen|stove|chulha|heater|heating)\b/i,
    pick: (p) => p.indoor.find((r) => r.id === 'kitchen' || r.id === 'heating'),
    fallback: 'Ventilate while cooking and avoid burning wood, coal or waste indoors.',
  },
  {
    pattern: /\b(commute|car|bus|metro|bike|cycle|transport|carpool|co2)\b/i,
    pick: (p) => p.sustainable.find((r) => r.id.startsWith('switch-')),
    fallback: 'Shared or public transport lowers both your emissions and the number of vehicles on the street.',
  },
]);

/**
 * Answers a question by matching it to a topic and quoting the relevant plan item.
 * @param {Plan} plan
 * @param {string} question
 * @returns {string}
 */
export function ruleAnswer(plan, question) {
  const topic = TOPICS.find((t) => t.pattern.test(question));
  if (!topic) {
    return `${plan.headline} ${plan.summary} Ask me about masks, purifiers, windows, outdoor exercise, cooking or commuting for more detail. This is general guidance, not medical advice.`;
  }
  const item = topic.pick(plan);
  return item ? [item.title + '.', item.detail, item.why].filter(Boolean).join(' ') : topic.fallback;
}
