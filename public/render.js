/**
 * Pure DOM rendering. All text is inserted with textContent / createTextNode, never innerHTML,
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

const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const hourLabel = (hr) => `${hr % 12 === 0 ? 12 : hr % 12}${hr >= 12 ? 'pm' : 'am'}`;
const windowLabel = (w) => `${hourLabel(w.start)} to ${hourLabel(w.end % 24)}`;

export function hourlyChart(air) {
  const W = 560;
  const H = 190;
  const pad = { l: 38, r: 10, t: 12, b: 26 };
  const max = Math.max(...air.hourly, 10) * 1.1;
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / 23;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-labelledby': 'chart-title chart-desc' });
  const title = svg('title', { id: 'chart-title' });
  title.textContent = 'PM2.5 through the day';
  const desc = svg('desc', { id: 'chart-desc' });
  desc.textContent = `Cleanest outdoor window ${windowLabel(air.bestWindow)} at about ${air.bestWindow.avg} micrograms per cubic metre. Worst window ${windowLabel(air.worstWindow)} at about ${air.worstWindow.avg}.`;
  root.append(title, desc);

  const band = (w, cls) => root.append(svg('rect', { class: cls, x: x(w.start), y: pad.t, width: x(Math.min(w.end, 23)) - x(w.start), height: H - pad.t - pad.b }));
  band(air.bestWindow, 'win-best');
  band(air.worstWindow, 'win-worst');

  root.append(svg('line', { class: 'ax', x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b }));
  for (const hr of [0, 6, 12, 18, 23]) {
    const t = svg('text', { x: x(hr), y: H - 8, 'text-anchor': 'middle' });
    t.textContent = hourLabel(hr);
    root.append(t);
  }
  for (const v of [0, Math.round(max / 2), Math.round(max)]) {
    const t = svg('text', { x: pad.l - 5, y: y(v) + 4, 'text-anchor': 'end' });
    t.textContent = String(v);
    root.append(t);
  }
  root.append(svg('polyline', { class: 'line', points: air.hourly.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') }));
  return root;
}

function bar(label, valueText, pct, cls = '') {
  const fill = h('div', { class: `bar-fill ${cls}` });
  fill.style.width = `${Math.max(2, Math.min(100, pct))}%`;
  return h('li', {}, h('div', { class: 'bar-label' }, h('span', {}, label), h('span', {}, valueText)), h('div', { class: 'bar-track', 'aria-hidden': 'true' }, fill));
}

function itemList(items) {
  return h('ul', { class: 'items' }, items.map((it) => h('li', { class: 'item' }, h('h4', {}, it.title), it.detail && h('p', {}, it.detail), it.why && h('p', { class: 'why' }, it.why))));
}

function section(id, title, body) {
  return h('section', { class: 'card', 'aria-labelledby': id }, h('h3', { id }, title), body);
}

const BAND_COLOR = ['--band-0', '--band-1', '--band-2', '--band-3', '--band-4', '--band-5'];

export function renderPlan(plan, narration) {
  const { airQuality: air, risk, impact } = plan;
  const hero = h('section', { class: 'card hero', 'aria-labelledby': 'hero-title' });
  hero.style.setProperty('--band-color', `var(${BAND_COLOR[air.band.index]})`);
  hero.append(
    h('div', { class: 'row' },
      h('div', { class: 'aqi' }, h('strong', {}, String(air.aqi)), h('span', {}, `AQI · ${air.band.label}`)),
      h('div', {},
        h('h3', { id: 'hero-title' }, plan.headline),
        h('p', {}, h('span', { class: 'badge' }, `Household risk: ${risk.label}`), ' ', air.location?.name ?? 'Manual reading', ` · PM2.5 ${air.pm25} µg/m³`),
        air.hourlyIsEstimated && h('p', { class: 'help' }, 'Hourly shape is estimated from a typical winter day.'),
      ),
    ),
    h('p', { class: 'narration' }, narration.text),
    h('p', { class: 'engine' }, narration.engine === 'gemini' ? 'Briefing written by Google Gemini from your plan.' : 'Briefing written by the built-in rules engine.'),
  );

  const out = [hero];

  if (impact.reductionPct > 0) {
    const maxDose = Math.max(impact.baseline.dose, 1);
    out.push(section('impact-title', 'The direct impact of your choices',
      h('div', {},
        h('div', { class: 'big' },
          h('div', { class: 'stat' }, h('b', {}, `-${impact.reductionPct}%`), h('small', {}, 'PM2.5 you breathe in per day')),
          h('div', { class: 'stat' }, h('b', {}, impact.cigarettesPerDayAvoided.toFixed(1)), h('small', {}, 'cigarettes\' worth of smoke avoided daily')),
          h('div', { class: 'stat' }, h('b', {}, `${impact.recommended.effectivePm25}`), h('small', {}, `µg/m³ effective exposure (was ${impact.baseline.effectivePm25})`)),
        ),
        h('ul', { class: 'bars', 'aria-label': 'Daily PM2.5 intake before and after' },
          bar('Without changes', `${impact.baseline.dose} µg`, 100, 'before'),
          bar('Following this plan', `${impact.recommended.dose} µg`, (impact.recommended.dose / maxDose) * 100),
        ),
        h('h4', {}, 'What each step is worth'),
        h('ul', { class: 'bars' }, impact.levers.map((l) => bar(l.label, `-${l.savedPct}%`, l.savedPct * 2))),
        h('p', { class: 'help' }, 'Estimates from a simple inhalation model: outdoor PM2.5 × time × breathing rate × how much air gets indoors. Illustrative, not clinical.'),
      )));
  }

  out.push(section('air-title', 'Today\'s air, hour by hour',
    h('div', {}, hourlyChart(air),
      h('p', {}, `Best outdoor window: ${windowLabel(air.bestWindow)}. Worst: ${windowLabel(air.worstWindow)}.`))));

  out.push(section('routine-title', 'Your low-exposure daily routine', itemList(plan.routine)));
  out.push(section('indoor-title', 'Indoor air quality hacks', itemList(plan.indoor)));
  out.push(section('green-title', 'Sustainable alternatives for your family and community', itemList(plan.sustainable)));
  out.push(h('p', { class: 'disclaimer' }, plan.disclaimer));
  return out;
}

export function chatMessage(role, text) {
  return h('div', { class: `msg ${role === 'user' ? 'user' : 'bot'}` }, text);
}
