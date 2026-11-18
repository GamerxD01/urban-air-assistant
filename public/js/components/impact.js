/**
 * "What your choices change": the headline reduction, cigarettes avoided and per-step savings.
 * @module components/impact
 */
import { h, svg } from '../dom.js';
import { block } from './block.js';

/** @typedef {import('../../../src/types.js').Impact} Impact */
/** @typedef {import('../../../src/types.js').Lever} Lever */

/** Cap on drawn cigarettes so a severe day stays readable. */
export const MAX_CIGARETTES = 14;

/**
 * One cigarette icon; avoided ones are struck through.
 * @param {boolean} avoided
 * @returns {SVGElement}
 */
export function cigaretteIcon(avoided) {
  const icon = svg('svg', { viewBox: '0 0 46 14', class: `cig${avoided ? ' avoided' : ''}`, 'aria-hidden': 'true' });
  svg('rect', { class: 'cig-body', x: 12, y: 3, width: 32, height: 8, rx: 1 }, icon);
  svg('rect', { class: 'cig-tip', x: 1, y: 3, width: 11, height: 8, rx: 1 }, icon);
  svg('rect', { class: 'cig-ash', x: 43, y: 4, width: 3, height: 6 }, icon);
  if (avoided) svg('line', { class: 'strike', x1: -1, y1: 13, x2: 47, y2: 1 }, icon);
  return icon;
}

/**
 * How many cigarettes to draw and how many of them to strike through.
 * @param {Impact} impact
 * @returns {{ total: number, avoided: number }}
 */
export function cigaretteCounts(impact) {
  const total = Math.min(MAX_CIGARETTES, Math.max(1, Math.round(impact.baseline.cigarettes)));
  return { total, avoided: Math.min(total, Math.round(impact.cigarettesPerDayAvoided)) };
}

/**
 * Row of cigarette icons with a text alternative.
 * @param {Impact} impact
 * @returns {HTMLDivElement}
 */
export function cigaretteTally(impact) {
  const { total, avoided } = cigaretteCounts(impact);
  const tally = h('div', {
    class: 'cigs',
    role: 'img',
    'aria-label': `${total} cigarettes, ${avoided} of them crossed out`,
  });
  for (let i = 0; i < total; i += 1) tally.append(cigaretteIcon(i >= total - avoided));
  return tally;
}

/**
 * Bars showing what each recommended step saves on its own, scaled to the biggest one.
 * @param {Lever[]} levers
 * @returns {HTMLUListElement}
 */
export function leverList(levers) {
  const maxPct = Math.max(...levers.map((l) => l.savedPct), 1);
  return h(
    'ul',
    { class: 'levers', 'aria-label': 'How much each step cuts on its own' },
    levers.map((lever) => {
      const fill = h('div', { class: 'lever-fill' });
      fill.style.width = `${(lever.savedPct / maxPct) * 100}%`;
      return h(
        'li',
        { class: 'lever' },
        h('span', { class: 'lever-name' }, lever.label),
        h('span', { class: 'lever-val' }, `−${lever.savedPct}%`),
        h('div', { class: 'lever-track', 'aria-hidden': 'true' }, fill),
      );
    }),
  );
}

/**
 * The whole impact section, or null when the plan asks for no changes.
 * @param {Impact} impact
 * @returns {HTMLElement | null}
 */
export function impactBlock(impact) {
  if (impact.reductionPct <= 0) return null;
  return block(
    'impact-title',
    'What your choices change',
    null,
    h(
      'div',
      { class: 'impact-head' },
      h(
        'div',
        {},
        h('p', { class: 'cut' }, `−${impact.reductionPct}%`),
        h('p', { class: 'cut-label' }, 'less PM2.5 reaching your lungs today'),
      ),
      h(
        'div',
        {},
        cigaretteTally(impact),
        h(
          'p',
          { class: 'cigs-caption' },
          `Breathing today's air without changes is like smoking ${impact.baseline.cigarettes.toFixed(1)} cigarettes. This plan takes away ${impact.cigarettesPerDayAvoided.toFixed(1)} of them.`,
        ),
      ),
    ),
    leverList(impact.levers),
    h(
      'p',
      { class: 'method' },
      `How we count: outdoor PM2.5 × hours × breathing rate × how much of it gets indoors or into your vehicle. ${Math.round(impact.baseline.dose)} µg inhaled without changes, ${Math.round(impact.recommended.dose)} µg with the plan. Estimates, not a medical measurement.`,
    ),
  );
}
