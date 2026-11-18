/**
 * Shared building blocks for plan sections.
 * @module components/block
 */
import { h } from '../dom.js';

/** @typedef {import('../../../src/types.js').Item} Item */
/** @typedef {import('../dom.js').Child} Child */

/**
 * A titled plan section, labelled for screen readers by its heading.
 * @param {string} id heading id
 * @param {string} title
 * @param {string | null} lede optional one-line introduction
 * @param {...Child} body
 * @returns {HTMLElement}
 */
export function block(id, title, lede, ...body) {
  return h(
    'section',
    { class: 'block', 'aria-labelledby': id },
    h('h3', { id }, title),
    lede && h('p', { class: 'lede' }, lede),
    ...body,
  );
}

/**
 * Title, detail and "why it matters" lines for one piece of advice.
 * @param {Item} item
 * @returns {HTMLElement[]}
 */
export function itemBody(item) {
  const parts = [h('p', { class: 'item-title' }, item.title)];
  if (item.detail) parts.push(h('p', { class: 'item-detail' }, item.detail));
  if (item.why) parts.push(h('p', { class: 'item-why' }, item.why));
  return parts;
}
