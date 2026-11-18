/**
 * Advice lists: the routine as a timeline, and tickable checklists for home and community.
 * @module components/advice
 */
import { h } from '../dom.js';
import { block, itemBody } from './block.js';

/** @typedef {import('../../../src/types.js').Item} Item */

/**
 * Routine items laid out against the time of day.
 * @param {Item[]} items
 * @returns {HTMLElement}
 */
export function timelineBlock(items) {
  return block(
    'day-title',
    'Your day',
    null,
    h(
      'ol',
      { class: 'timeline' },
      items.map((item) =>
        h('li', {}, h('p', { class: 'when' }, item.when ?? 'All day'), h('div', {}, ...itemBody(item))),
      ),
    ),
  );
}

/**
 * A checklist whose progress line updates (and is announced) as items are ticked.
 * @param {string} name prefix for checkbox ids, unique per page
 * @param {Item[]} items
 * @returns {[HTMLParagraphElement, HTMLUListElement]}
 */
export function checklist(name, items) {
  const progress = h('p', { class: 'progress', 'aria-live': 'polite' });
  const list = h(
    'ul',
    { class: 'checklist' },
    items.map((item, i) => {
      const id = `${name}-${i}`;
      return h(
        'li',
        {},
        h(
          'label',
          { class: 'check-row', for: id },
          h('input', { type: 'checkbox', id }),
          h('span', { class: 'check-body' }, ...itemBody(item)),
        ),
      );
    }),
  );
  const update = () => {
    const done = [...list.querySelectorAll('input')].filter((box) => box.checked).length;
    progress.textContent = `${done} of ${items.length} done`;
  };
  list.addEventListener('change', update);
  update();
  return [progress, list];
}

/**
 * @param {Item[]} items
 * @returns {HTMLElement}
 */
export const homeBlock = (items) =>
  block('home-title', 'At home', 'Tick things off as you do them.', ...checklist('home', items));

/**
 * @param {Item[]} items
 * @returns {HTMLElement}
 */
export const streetBlock = (items) =>
  block(
    'street-title',
    'For your street and city',
    'Changes that clean the air for everyone around you, not just your household.',
    ...checklist('street', items),
  );
