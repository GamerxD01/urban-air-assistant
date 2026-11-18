/**
 * Composes the plan view from its components, in reading order.
 * @module render
 */
import { h } from './dom.js';
import { homeBlock, streetBlock, timelineBlock } from './components/advice.js';
import { briefingBlock } from './components/briefing.js';
import { dayStripBlock } from './components/dayStrip.js';
import { impactBlock } from './components/impact.js';

/** @typedef {import('../../src/types.js').Plan} Plan */
/** @typedef {import('../../src/types.js').Narration} Narration */

/**
 * @param {HTMLElement | null | undefined} section
 * @returns {section is HTMLElement}
 */
const isPresent = (section) => section !== null && section !== undefined;

/**
 * @param {Plan} plan
 * @param {Narration} narration
 * @param {HTMLElement} [chat] optional chat section, placed after the advice
 * @returns {HTMLElement[]}
 */
export function renderPlan(plan, narration, chat) {
  const sections = [
    briefingBlock(narration),
    dayStripBlock(plan.airQuality),
    impactBlock(plan.impact),
    timelineBlock(plan.routine),
    homeBlock(plan.indoor),
    streetBlock(plan.sustainable),
    chat,
    h('p', { class: 'disclaimer' }, plan.disclaimer),
  ];
  return sections.filter(isPresent);
}
