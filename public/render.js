/**
 * Pure DOM rendering. All text goes in through textContent / text nodes, never innerHTML,
 * so API data (including model output) can never inject markup.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function s(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (parent) parent.append(el);
  return el;
}

export const BAND_VARS = ['--b0', '--b1', '--b2', '--b3', '--b4', '--b5'];
const PM_EDGES = [30, 60, 90, 120, 250];
const bandOf = (pm) => { const i = PM_EDGES.findIndex((e) => pm <= e); return i === -1 ? 5 : i; };
const hourLabel = (hr) => `${hr % 12 === 0 ? 12 : hr % 12}${hr % 24 >= 12 ? 'pm' : 'am'}`;
const span = (w) => `from ${hourLabel(w.start)} to ${hourLabel(w.end % 24)}`;

/** 24 bars, one per hour, coloured by CPCB band, with brackets for the go-out and stay-in windows. */
function dayStrip(air) {
  const W = 720;
  const H = 230;
  const pad = { l: 6, r: 6, t: 46, b: 26 };
  const max = Math.max(...air.hourly, 60);
  const slot = (W - pad.l - pad.r) / 24;
  const x = (i) => pad.l + i * slot;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': 'strip-t strip-d' });
  s('title', { id: 'strip-t' }, svg).textContent = 'PM2.5 for each hour of today';
  s('desc', { id: 'strip-d' }, svg).textContent =
    `Best time to go out is ${span(air.bestWindow)}, about ${Math.round(air.bestWindow.avg)} micrograms per cubic metre. ` +
    `Worst is ${span(air.worstWindow)}, about ${Math.round(air.worstWindow.avg)}.`;

  air.hourly.forEach((v, i) => {
    const bar = s('rect', { class: 'bar', x: (x(i) + 2).toFixed(1), y: y(v).toFixed(1), width: (slot - 4).toFixed(1), height: (H - pad.b - y(v)).toFixed(1), rx: 3 }, svg);
    bar.style.fill = `var(${BAND_VARS[bandOf(v)]})`;
  });

  const bracket = (w, label, cls) => {
    const x0 = x(w.start) + 2;
    const x1 = x(Math.min(w.end, 24)) - 2;
    const top = pad.t - 16;
    s('path', { class: `bracket ${cls}`, d: `M ${x0} ${top + 8} V ${top} H ${x1} V ${top + 8}` }, svg);
    const t = s('text', { class: 'mark-label', x: (x0 + x1) / 2, y: top - 8, 'text-anchor': 'middle' }, svg);
    t.textContent = label;
  };
  bracket(air.bestWindow, 'Go out', 'go');
  bracket(air.worstWindow, 'Stay in', 'stay');

  for (let hr = 0; hr < 24; hr += 3) {
    const t = s('text', { x: x(hr) + slot / 2, y: H - 6, 'text-anchor': 'middle' }, svg);
    t.textContent = hourLabel(hr);
  }
  return svg;
}

const LEGEND = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very poor', 'Severe'];

function cigarette(avoided) {
  const svg = s('svg', { viewBox: '0 0 46 14', class: `cig${avoided ? ' avoided' : ''}`, 'aria-hidden': 'true' });
  s('rect', { class: 'cig-body', x: 12, y: 3, width: 32, height: 8, rx: 1 }, svg);
  s('rect', { class: 'cig-tip', x: 1, y: 3, width: 11, height: 8, rx: 1 }, svg);
  s('rect', { class: 'cig-ash', x: 43, y: 4, width: 3, height: 6 }, svg);
  if (avoided) s('line', { class: 'strike', x1: -1, y1: 13, x2: 47, y2: 1 }, svg);
  return svg;
}

function block(id, title, lede, ...body) {
  return h('section', { class: 'block', 'aria-labelledby': id }, h('h3', { id }, title), lede && h('p', { class: 'lede' }, lede), ...body);
}

function itemBody(it) {
  return [
    h('p', { class: 'item-title' }, it.title),
    it.detail && h('p', { class: 'item-detail' }, it.detail),
    it.why && h('p', { class: 'item-why' }, it.why),
  ];
}

function checklist(name, items) {
  const progress = h('p', { class: 'progress', 'aria-live': 'polite' });
  const update = () => {
    const done = list.querySelectorAll('input:checked').length;
    progress.textContent = `${done} of ${items.length} done`;
  };
  const list = h('ul', { class: 'checklist' }, items.map((it, i) => {
    const id = `${name}-${i}`;
    return h('li', {},
      h('label', { class: 'check-row', for: id },
        h('input', { type: 'checkbox', id }),
        h('span', { class: 'check-body' }, ...itemBody(it))));
  }));
  list.addEventListener('change', update);
  update();
  return [progress, list];
}

export function renderPlan(plan, narration) {
  const { airQuality: air, impact } = plan;
  const out = [];

  out.push(h('section', { class: 'block', 'aria-labelledby': 'brief-title' },
    h('h3', { id: 'brief-title', class: 'sr-only' }, 'Today\'s briefing'),
    h('p', { class: 'briefing' }, narration.text),
    h('p', { class: 'engine' }, narration.engine === 'gemini'
      ? 'Written by Google Gemini from the numbers in your plan.'
      : 'Written by the built-in rules engine from the numbers in your plan.')));

  const strip = h('div', { class: 'strip' }, dayStrip(air),
    h('ul', { class: 'legend', 'aria-label': 'Colour key, CPCB AQI bands' },
      LEGEND.map((name, i) => h('li', {}, h('span', { class: `swatch sw${i}` }), name))));
  out.push(block('strip-title', 'Today, hour by hour',
    air.hourlyIsEstimated
      ? 'Shape estimated from a typical winter day, scaled to your reading.'
      : `Hourly PM2.5 forecast for ${air.location?.name ?? 'your area'}. Each bar is one hour.`,
    strip,
    h('p', { class: 'strip-note' }, `Go out ${span(air.bestWindow)}. Stay in ${span(air.worstWindow)}, when the air is about ${Math.round((air.worstWindow.avg / air.bestWindow.avg - 1) * 100)}% dirtier.`)));

  if (impact.reductionPct > 0) {
    const total = Math.min(14, Math.max(1, Math.round(impact.baseline.cigarettes)));
    const saved = Math.min(total, Math.round(impact.cigarettesPerDayAvoided));
    const cigs = h('div', { class: 'cigs', role: 'img', 'aria-label': `${total} cigarettes, ${saved} of them crossed out` });
    for (let i = 0; i < total; i += 1) cigs.append(cigarette(i >= total - saved));

    const maxPct = Math.max(...impact.levers.map((l) => l.savedPct), 1);
    out.push(block('impact-title', 'What your choices change', null,
      h('div', { class: 'impact-head' },
        h('div', {}, h('p', { class: 'cut' }, `−${impact.reductionPct}%`), h('p', { class: 'cut-label' }, 'less PM2.5 reaching your lungs today')),
        h('div', {}, cigs, h('p', { class: 'cigs-caption' },
          `Breathing today's air without changes is like smoking ${impact.baseline.cigarettes.toFixed(1)} cigarettes. This plan takes away ${impact.cigarettesPerDayAvoided.toFixed(1)} of them.`))),
      h('ul', { class: 'levers', 'aria-label': 'How much each step cuts on its own' }, impact.levers.map((l) => {
        const fill = h('div', { class: 'lever-fill' });
        fill.style.width = `${(l.savedPct / maxPct) * 100}%`;
        return h('li', { class: 'lever' }, h('span', { class: 'lever-name' }, l.label), h('span', { class: 'lever-val' }, `−${l.savedPct}%`), h('div', { class: 'lever-track', 'aria-hidden': 'true' }, fill));
      })),
      h('p', { class: 'method' }, `How we count: outdoor PM2.5 × hours × breathing rate × how much of it gets indoors or into your vehicle. ${Math.round(impact.baseline.dose)} µg inhaled without changes, ${Math.round(impact.recommended.dose)} µg with the plan. Estimates, not a medical measurement.`)));
  }

  out.push(block('day-title', 'Your day', null,
    h('ol', { class: 'timeline' }, plan.routine.map((it) => h('li', {}, h('p', { class: 'when' }, it.when ?? 'All day'), h('div', {}, ...itemBody(it)))))));

  out.push(block('home-title', 'At home', 'Tick things off as you do them.', ...checklist('home', plan.indoor)));
  out.push(block('street-title', 'For your street and city', 'Changes that clean the air for everyone around you, not just your household.', ...checklist('street', plan.sustainable)));
  return out;
}

export function chatMessage(role, text) {
  return h('div', { class: `msg ${role === 'user' ? 'user' : 'bot'}` }, text);
}
