import { mount } from './helpers/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/engine/plan.js';
import { h, svg } from '../public/js/dom.js';
import { block, itemBody } from '../public/js/components/block.js';
import { briefingBlock } from '../public/js/components/briefing.js';
import { dayStripBlock, dayStripChart, bandLegend, BAND_NAMES } from '../public/js/components/dayStrip.js';
import {
  impactBlock,
  cigaretteCounts,
  cigaretteTally,
  leverList,
  MAX_CIGARETTES,
} from '../public/js/components/impact.js';
import { timelineBlock, checklist, homeBlock, streetBlock } from '../public/js/components/advice.js';
import { chatBlock, chatMessage, SUGGESTIONS } from '../public/js/components/chat.js';
import { heroContent, updateHero } from '../public/js/components/hero.js';
import { renderPlan } from '../public/js/render.js';

const severe = buildPlan({
  airQuality: { aqi: 420, location: { name: 'Delhi, India' } },
  profile: { household: { children: true, respiratory: true }, lifestyle: { commute: 'car', commuteKm: 12 } },
});
const clean = buildPlan({ airQuality: { pm25: 15 }, profile: {} });

test('h builds elements safely: text is never parsed as HTML', () => {
  const el = h('p', { class: 'x', hidden: true, title: null }, '<img src=x onerror=alert(1)>', 3, false, null);
  assert.equal(el.className, 'x');
  assert.equal(el.getAttribute('hidden'), '');
  assert.equal(el.hasAttribute('title'), false);
  assert.equal(el.querySelector('img'), null, 'markup in text stays text');
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>3');
  const icon = svg('svg', { viewBox: '0 0 1 1', skip: false });
  assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(icon.hasAttribute('skip'), false);
});

test('block labels the section by its heading', () => {
  const section = block('t1', 'Title', 'Lede', h('p', {}, 'body'));
  assert.equal(section.getAttribute('aria-labelledby'), 't1');
  assert.equal(section.querySelector('h3').id, 't1');
  assert.equal(section.querySelector('.lede').textContent, 'Lede');
  assert.equal(block('t2', 'T', null).querySelector('.lede'), null);
  assert.equal(itemBody({ id: 'a', title: 'A', why: 'W', tag: 'indoor' }).length, 2);
});

test('briefing credits the engine that wrote it', () => {
  assert.match(briefingBlock({ text: 'Hi', engine: 'gemini' }).textContent, /Google Gemini/);
  assert.match(briefingBlock({ text: 'Hi', engine: 'rules' }).textContent, /rules engine/);
});

test('day strip draws 24 band-coloured bars with an accessible description', () => {
  const chart = dayStripChart(severe.airQuality);
  assert.equal(chart.querySelectorAll('rect.bar').length, 24);
  assert.equal(chart.getAttribute('role'), 'img');
  assert.match(chart.querySelector('desc').textContent, /Best time to go out is from/);
  assert.deepEqual(
    [...chart.querySelectorAll('.mark-label')].map((t) => t.textContent),
    ['Go out', 'Stay in'],
  );
  assert.equal(bandLegend().querySelectorAll('li').length, BAND_NAMES.length);
  assert.match(dayStripBlock(severe.airQuality).querySelector('.lede').textContent, /estimated/);
});

test('impact shows the reduction, a capped cigarette tally and per-step bars', () => {
  const section = impactBlock(severe.impact);
  assert.ok(section);
  assert.equal(section.querySelector('.cut').textContent, `−${severe.impact.reductionPct}%`);
  const { total, avoided } = cigaretteCounts(severe.impact);
  assert.ok(total <= MAX_CIGARETTES && avoided <= total);
  const tally = cigaretteTally(severe.impact);
  assert.equal(tally.querySelectorAll('svg').length, total);
  assert.equal(tally.querySelectorAll('svg.avoided').length, avoided);
  assert.match(tally.getAttribute('aria-label'), /crossed out/);
  const levers = leverList(severe.impact.levers);
  assert.equal(levers.querySelectorAll('li').length, severe.impact.levers.length);
  assert.equal(impactBlock(clean.impact), null, 'nothing to show when no change is needed');
});

test('timeline shows when to do each step', () => {
  const section = timelineBlock(severe.routine);
  const whens = [...section.querySelectorAll('.when')].map((w) => w.textContent);
  assert.equal(whens.length, severe.routine.length);
  assert.ok(whens.every(Boolean));
});

test('checklist progress updates as items are ticked', () => {
  const root = mount();
  const [progress, list] = checklist('t', severe.indoor);
  root.append(progress, list);
  assert.equal(progress.textContent, `0 of ${severe.indoor.length} done`);
  const box = list.querySelector('input');
  box.checked = true;
  list.dispatchEvent(new Event('change'));
  assert.equal(progress.textContent, `1 of ${severe.indoor.length} done`);
  assert.equal(list.querySelector('label').getAttribute('for'), 't-0');
  assert.ok(homeBlock(severe.indoor).querySelector('#home-0'));
  assert.ok(streetBlock(severe.sustainable).querySelector('#street-0'));
});

test('chat sends questions with history and shows answers or errors', async () => {
  const calls = [];
  const section = chatBlock({
    ask: async (q, history) => {
      calls.push({ q, history });
      if (q === 'fail') throw new Error('Too many requests.');
      return `answer to ${q}`;
    },
  });
  mount().append(section);
  assert.equal(section.querySelectorAll('.chip').length, SUGGESTIONS.length);

  const form = section.querySelector('form');
  const input = section.querySelector('#chat-input');
  input.value = 'mask?';
  form.dispatchEvent(new Event('submit'));
  await new Promise((r) => setTimeout(r, 0));
  input.value = 'fail';
  form.dispatchEvent(new Event('submit'));
  await new Promise((r) => setTimeout(r, 0));

  const messages = [...section.querySelectorAll('.msg')].map((m) => [m.className, m.textContent]);
  assert.deepEqual(messages, [
    ['msg user', 'mask?'],
    ['msg bot', 'answer to mask?'],
    ['msg user', 'fail'],
    ['msg bot', 'Too many requests.'],
  ]);
  assert.equal(calls[1].history.length, 2, 'second question carries the first exchange');
  assert.equal(section.querySelector('button[type=submit]').disabled, false);
  assert.equal(chatMessage('assistant', 'x').className, 'msg bot');
});

test('hero shows the place, band and household risk', () => {
  const content = heroContent(severe);
  assert.equal(content.title, 'Delhi: severe air today.');
  assert.equal(content.aqi, String(severe.airQuality.aqi));
  assert.match(content.detail, /Household risk: severe/);
  const refs = { title: h('h1'), reading: h('div', { hidden: true }), aqi: h('span'), detail: h('p') };
  refs.reading.hidden = true;
  updateHero(refs, severe);
  assert.equal(refs.title.textContent, content.title);
  assert.equal(refs.reading.hidden, false);
});

test('renderPlan composes every section in reading order', () => {
  const chat = chatBlock({ ask: async () => 'x' });
  const sections = renderPlan(severe, { text: 'Brief', engine: 'rules' }, chat);
  const ids = sections.map((s) => s.getAttribute('aria-labelledby') ?? s.className);
  assert.deepEqual(ids, [
    'brief-title',
    'strip-title',
    'impact-title',
    'day-title',
    'home-title',
    'street-title',
    'chat-title',
    'disclaimer',
  ]);
  const calm = renderPlan(clean, { text: 'Brief', engine: 'rules' });
  assert.ok(!calm.some((s) => s.getAttribute('aria-labelledby') === 'impact-title'));
});

test('$ finds static elements and fails loudly when one is missing', async () => {
  const { $ } = await import('../public/js/dom.js');
  mount().append(h('p', { id: 'here' }, 'x'));
  assert.equal($('#here').textContent, 'x');
  assert.throws(() => $('#missing'), /Missing element: #missing/);
});

test('suggestion chips ask their question', async () => {
  const asked = [];
  const section = chatBlock({
    ask: async (q) => {
      asked.push(q);
      return 'ok';
    },
  });
  mount().append(section);
  section.querySelector('.chip').dispatchEvent(new Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, [SUGGESTIONS[0]]);
});
