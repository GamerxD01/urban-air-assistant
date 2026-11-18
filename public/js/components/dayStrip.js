/**
 * "Today, hour by hour": 24 bars coloured by CPCB band, with brackets over the go-out and
 * stay-in windows, plus a text description so the chart never relies on colour alone.
 * @module components/dayStrip
 */
import { h, svg } from '../dom.js';
import { BAND_VARS, bandOf, hourLabel, pctDirtier, timeSpan } from '../format.js';
import { block } from './block.js';

/** @typedef {import('../../../src/types.js').AirQuality} AirQuality */
/** @typedef {import('../../../src/types.js').TimeWindow} TimeWindow */

const WIDTH = 720;
const HEIGHT = 230;
const PAD = Object.freeze({ left: 6, right: 6, top: 46, bottom: 26 });
const HOURS = 24;
const LABEL_EVERY_HOURS = 3;
/** Y-axis floor so a clean day still shows short bars rather than full-height ones. */
const MIN_SCALE_PM25 = 60;
const BAR_GAP = 4;
export const BAND_NAMES = Object.freeze(['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very poor', 'Severe']);

/**
 * The SVG chart itself.
 * @param {AirQuality} air
 * @returns {SVGElement}
 */
export function dayStripChart(air) {
  const max = Math.max(...air.hourly, MIN_SCALE_PM25);
  const slot = (WIDTH - PAD.left - PAD.right) / HOURS;
  /** @param {number} i */
  const x = (i) => PAD.left + i * slot;
  /** @param {number} v */
  const y = (v) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / max);

  const chart = svg('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img', 'aria-labelledby': 'strip-t strip-d' });
  svg('title', { id: 'strip-t' }, chart).textContent = 'PM2.5 for each hour of today';
  svg('desc', { id: 'strip-d' }, chart).textContent =
    `Best time to go out is ${timeSpan(air.bestWindow)}, about ${Math.round(air.bestWindow.avg)} micrograms per cubic metre. ` +
    `Worst is ${timeSpan(air.worstWindow)}, about ${Math.round(air.worstWindow.avg)}.`;

  air.hourly.forEach((value, i) => {
    const bar = svg(
      'rect',
      {
        class: 'bar',
        'data-band': bandOf(value),
        x: (x(i) + BAR_GAP / 2).toFixed(1),
        y: y(value).toFixed(1),
        width: (slot - BAR_GAP).toFixed(1),
        height: (HEIGHT - PAD.bottom - y(value)).toFixed(1),
        rx: 3,
      },
      chart,
    );
    bar.style.fill = `var(${BAND_VARS[bandOf(value)]})`;
  });

  /**
   * @param {TimeWindow} window
   * @param {string} label
   * @param {string} cls
   */
  const bracket = (window, label, cls) => {
    const x0 = x(window.start) + BAR_GAP / 2;
    const x1 = x(Math.min(window.end, HOURS)) - BAR_GAP / 2;
    const top = PAD.top - 16;
    svg('path', { class: `bracket ${cls}`, d: `M ${x0} ${top + 8} V ${top} H ${x1} V ${top + 8}` }, chart);
    svg('text', { class: 'mark-label', x: (x0 + x1) / 2, y: top - 8, 'text-anchor': 'middle' }, chart).textContent =
      label;
  };
  bracket(air.bestWindow, 'Go out', 'go');
  bracket(air.worstWindow, 'Stay in', 'stay');

  for (let hour = 0; hour < HOURS; hour += LABEL_EVERY_HOURS) {
    svg('text', { x: x(hour) + slot / 2, y: HEIGHT - 6, 'text-anchor': 'middle' }, chart).textContent = hourLabel(hour);
  }
  return chart;
}

/** @returns {HTMLUListElement} colour key for the CPCB bands */
export function bandLegend() {
  return h(
    'ul',
    { class: 'legend', 'aria-label': 'Colour key, CPCB AQI bands' },
    BAND_NAMES.map((name, i) => h('li', {}, h('span', { class: `swatch sw${i}` }), name)),
  );
}

/**
 * The whole "Today, hour by hour" section.
 * @param {AirQuality} air
 * @returns {HTMLElement}
 */
export function dayStripBlock(air) {
  const lede = air.hourlyIsEstimated
    ? 'Shape estimated from a typical winter day, scaled to your reading.'
    : `Hourly PM2.5 forecast for ${air.location?.name ?? 'your area'}. Each bar is one hour.`;
  return block(
    'strip-title',
    'Today, hour by hour',
    lede,
    h('div', { class: 'strip' }, dayStripChart(air), bandLegend()),
    h(
      'p',
      { class: 'strip-note' },
      `Go out ${timeSpan(air.bestWindow)}. Stay in ${timeSpan(air.worstWindow)}, when the air is about ${pctDirtier(air.worstWindow, air.bestWindow)}% dirtier.`,
    ),
  );
}
