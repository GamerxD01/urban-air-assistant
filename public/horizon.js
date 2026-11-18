/**
 * The haze horizon: a city skyline drawn in three depth layers. Smog is rendered as
 * semi-transparent haze between the layers, so as PM2.5 rises the far city disappears first
 * and the winter sun fades to a pale disc - the way smog actually looks from a rooftop.
 */

import { lerp, mixColor } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1440;
const H = 420;

const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.append(node);
  return node;
};

/** Small deterministic PRNG so the skyline is identical on every load. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function blocks(r, { y0, minH, maxH, minW, maxW, gap }) {
  let x = -20;
  let d = `M -20 ${H}`;
  while (x < W + 20) {
    const w = minW + r() * (maxW - minW);
    const h = minH + r() * (maxH - minH);
    const top = y0 - h;
    d += ` L ${x.toFixed(1)} ${top.toFixed(1)}`;
    if (r() > 0.72) {
      // water tank on the roof, very common on Indian apartment blocks
      const tx = x + w * 0.25;
      d += ` L ${tx.toFixed(1)} ${top.toFixed(1)} L ${tx.toFixed(1)} ${(top - 10).toFixed(1)} L ${(tx + 14).toFixed(1)} ${(top - 10).toFixed(1)} L ${(tx + 14).toFixed(1)} ${top.toFixed(1)}`;
    }
    d += ` L ${(x + w).toFixed(1)} ${top.toFixed(1)}`;
    x += w + r() * gap;
    d += ` L ${x.toFixed(1)} ${top.toFixed(1)} L ${x.toFixed(1)} ${(y0 - minH * 0.4).toFixed(1)}`;
  }
  return `${d} L ${W + 20} ${H} Z`;
}

function dome(cx, base, r) {
  // onion dome on a drum, with a finial
  const drum = r * 1.1;
  return [
    `M ${cx - drum} ${base} L ${cx - drum} ${base - r * 0.7} L ${cx + drum} ${base - r * 0.7} L ${cx + drum} ${base} Z`,
    `M ${cx - r} ${base - r * 0.7} C ${cx - r * 1.25} ${base - r * 1.6}, ${cx - r * 0.2} ${base - r * 1.9}, ${cx} ${base - r * 2.4} C ${cx + r * 0.2} ${base - r * 1.9}, ${cx + r * 1.25} ${base - r * 1.6}, ${cx + r} ${base - r * 0.7} Z`,
    `M ${cx - 1.5} ${base - r * 2.4} L ${cx - 1.5} ${base - r * 2.75} L ${cx + 1.5} ${base - r * 2.75} L ${cx + 1.5} ${base - r * 2.4} Z`,
  ].join(' ');
}

function minaret(cx, base, h, w = 9) {
  return `M ${cx - w / 2} ${base} L ${cx - w / 2} ${base - h} L ${cx - w * 0.9} ${base - h - 4} L ${cx + w * 0.9} ${base - h - 4} L ${cx + w / 2} ${base - h} L ${cx + w / 2} ${base} Z M ${cx - w * 0.6} ${base - h - 4} C ${cx - w * 0.6} ${base - h - 14}, ${cx} ${base - h - 18}, ${cx} ${base - h - 22} C ${cx} ${base - h - 18}, ${cx + w * 0.6} ${base - h - 14}, ${cx + w * 0.6} ${base - h - 4} Z`;
}

function gate(cx, base, w, h) {
  // a monumental gateway with a pointed arch cut out (evenodd fill)
  const aw = w * 0.36;
  const ah = h * 0.62;
  return `M ${cx - w / 2} ${base} L ${cx - w / 2} ${base - h} L ${cx - w * 0.3} ${base - h - 18} L ${cx} ${base - h - 30} L ${cx + w * 0.3} ${base - h - 18} L ${cx + w / 2} ${base - h} L ${cx + w / 2} ${base} Z
    M ${cx - aw} ${base} L ${cx - aw} ${base - ah * 0.65} C ${cx - aw} ${base - ah}, ${cx - aw * 0.2} ${base - ah}, ${cx} ${base - ah * 1.12} C ${cx + aw * 0.2} ${base - ah}, ${cx + aw} ${base - ah}, ${cx + aw} ${base - ah * 0.65} L ${cx + aw} ${base} Z`;
}

function pylon(x, base, h) {
  return `M ${x - 16} ${base} L ${x - 3} ${base - h} L ${x + 3} ${base - h} L ${x + 16} ${base} L ${x + 12} ${base} L ${x + 1} ${base - h + 14} L ${x - 1} ${base - h + 14} L ${x - 12} ${base} Z M ${x - 22} ${base - h + 22} L ${x + 22} ${base - h + 22} L ${x + 22} ${base - h + 26} L ${x - 22} ${base - h + 26} Z`;
}

function trees(r, y0) {
  let d = '';
  for (let x = 0; x < W; x += 40 + r() * 90) {
    const s = 14 + r() * 18;
    d += ` M ${x} ${y0} C ${x - s} ${y0 - s * 0.2}, ${x - s * 1.1} ${y0 - s * 1.6}, ${x} ${y0 - s * 1.8} C ${x + s * 1.1} ${y0 - s * 1.6}, ${x + s} ${y0 - s * 0.2}, ${x} ${y0} Z`;
  }
  return d;
}

const mix = mixColor;

export function createHorizon(container) {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMax slice',
    class: 'horizon-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const defs = el('defs', {}, svg);
  const grad = el('linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  const stopTop = el('stop', { offset: '0' }, grad);
  const stopBottom = el('stop', { offset: '1' }, grad);
  const glow = el('radialGradient', { id: 'sunglow' }, defs);
  el('stop', { offset: '0', 'stop-color': '#fff6d8', 'stop-opacity': '0.9' }, glow);
  el('stop', { offset: '1', 'stop-color': '#fff6d8', 'stop-opacity': '0' }, glow);

  el('rect', { width: W, height: H, fill: 'url(#sky)' }, svg);
  const sunGlow = el('circle', { cx: 1080, cy: 150, r: 150, fill: 'url(#sunglow)', class: 'fade' }, svg);
  const sun = el('circle', { cx: 1080, cy: 150, r: 44, class: 'fade sun' }, svg);

  const r = rng(26);
  const far = el(
    'path',
    {
      class: 'layer far',
      d: `${blocks(r, { y0: 330, minH: 60, maxH: 170, minW: 26, maxW: 70, gap: 18 })} ${pylon(250, 330, 150)} ${pylon(1300, 330, 130)}`,
    },
    svg,
  );
  const hazeFar = el('rect', { width: W, height: H, class: 'fade haze' }, svg);

  el('path', { class: 'layer mid', d: blocks(r, { y0: 360, minH: 30, maxH: 100, minW: 40, maxW: 110, gap: 30 }) }, svg);
  el(
    'path',
    {
      class: 'layer mid',
      d: [
        dome(560, 300, 46),
        minaret(480, 360, 150),
        minaret(640, 360, 150),
        'M 470 360 L 470 300 L 650 300 L 650 360 Z',
      ].join(' '),
    },
    svg,
  );
  el('path', { class: 'layer mid', 'fill-rule': 'evenodd', d: gate(900, 360, 150, 120) }, svg);
  const hazeMid = el('rect', { width: W, height: H, class: 'fade haze' }, svg);

  el('path', { class: 'layer near', d: trees(r, 392) }, svg);
  const hazeNear = el('rect', { width: W, height: H, class: 'fade haze' }, svg);
  // street level stays solid so the headline below always sits on the same dark ground
  el('rect', { class: 'layer near', x: -20, y: 391, width: W + 40, height: H - 391 }, svg);
  void far;

  container.replaceChildren(svg);

  /** @param {number} pm25 daily mean PM2.5; undefined = neutral "unknown" sky */
  function setAir(pm25) {
    const s = pm25 === undefined ? 0.35 : Math.min(1, Math.max(0, pm25 / 260));
    stopTop.style.stopColor = mix('#5f9fd3', '#8a826f', s);
    stopBottom.style.stopColor = mix('#d6e8f3', '#d2c09a', s);
    hazeFar.style.fill = hazeMid.style.fill = hazeNear.style.fill = mix('#dfe9ee', '#cdbb94', s);
    hazeFar.style.opacity = lerp(0.12, 0.9, s);
    hazeMid.style.opacity = lerp(0.04, 0.62, s);
    hazeNear.style.opacity = lerp(0, 0.18, s);
    sun.style.fill = mix('#fff2c2', '#f1d7aa', s);
    sun.style.opacity = lerp(1, 0.55, s);
    sunGlow.style.opacity = lerp(1, 0.08, s);
  }

  setAir(undefined);
  return { setAir };
}
