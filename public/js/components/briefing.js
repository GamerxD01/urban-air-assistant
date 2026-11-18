/**
 * The plain-language briefing at the top of the plan.
 * @module components/briefing
 */
import { h } from '../dom.js';

/** @typedef {import('../../../src/types.js').Narration} Narration */

/**
 * @param {Narration} narration
 * @returns {HTMLElement}
 */
export function briefingBlock(narration) {
  const source =
    narration.engine === 'gemini'
      ? 'Written by Google Gemini from the numbers in your plan.'
      : 'Written by the built-in rules engine from the numbers in your plan.';
  return h(
    'section',
    { class: 'block', 'aria-labelledby': 'brief-title' },
    h('h3', { id: 'brief-title', class: 'sr-only' }, "Today's briefing"),
    h('p', { class: 'briefing' }, narration.text),
    h('p', { class: 'engine' }, source),
  );
}
