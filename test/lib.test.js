import test from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, adviceItem } from '../src/engine/template.js';
import { TtlCache } from '../src/lib/ttlCache.js';
import { ROUTINE_ADVICE, INDOOR_ADVICE, COMMUNITY_ADVICE, COMMUTE_SWITCHES } from '../src/data/advice.js';
import { extractText } from '../src/services/gemini.js';
import { postJson, requestPlan, askQuestion } from '../public/js/api.js';
import { clamp, mean, round1, round2, pctChange } from '../src/engine/math.js';

test('fillTemplate replaces placeholders and fails loudly on missing values', () => {
  assert.equal(fillTemplate('Go out at {best} ({pct}%)', { best: '1pm-3pm', pct: 12 }), 'Go out at 1pm-3pm (12%)');
  assert.equal(fillTemplate('No placeholders'), 'No placeholders');
  assert.throws(() => fillTemplate('Hello {name}'), /Missing value for \{name\}/);
});

test('adviceItem fills every field and keeps optional ones optional', () => {
  const item = adviceItem({ id: 'switch-{mode}', tag: 'community', title: '{t}', why: 'w' }, { mode: 'car', t: 'T' });
  assert.deepEqual(item, { id: 'switch-car', tag: 'community', title: 'T', why: 'w' });
});

test('every advice template renders with the variables the engine provides', () => {
  const vars = {
    band: 'poor',
    aqi: 250,
    best: '1pm-3pm',
    worst: '7pm-10pm',
    bestAvg: 50,
    pctDirtier: 120,
    outdoorDuration: '1 hour',
    onCommute: '',
    mode: 'carpool',
    switchTitle: 'Carpool',
    km: 10,
    personalNote: 'note',
    co2: 8.5,
  };
  const all = [...Object.values(ROUTINE_ADVICE), ...Object.values(INDOOR_ADVICE), ...Object.values(COMMUNITY_ADVICE)];
  for (const template of all) {
    const item = adviceItem(template, vars);
    assert.ok(item.title && item.why, template.id);
    assert.doesNotMatch(JSON.stringify(item), /\{\w+\}/, `${template.id} has no unfilled placeholders`);
  }
  for (const options of Object.values(COMMUTE_SWITCHES)) {
    for (const { mode, title } of options) assert.ok(mode && title);
  }
});

test('TtlCache expires entries and evicts the oldest when full', () => {
  const cache = new TtlCache({ ttlMs: 100, maxEntries: 2 });
  cache.set('a', 1, 0);
  cache.set('b', 2, 0);
  assert.equal(cache.get('a', 50), 1);
  cache.set('c', 3, 60);
  assert.equal(cache.get('a', 60), undefined, 'oldest evicted');
  assert.equal(cache.size, 2);
  assert.equal(cache.get('b', 200), undefined, 'expired');
  cache.set('c', 4, 200);
  assert.equal(cache.get('c', 210), 4, 'overwrite keeps size');
  cache.clear();
  assert.equal(cache.size, 0);
});

test('math helpers', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(round1(1.26), 1.3);
  assert.equal(round2(1.256), 1.26);
  assert.equal(pctChange(150, 100), 50);
  assert.equal(pctChange(5, 0), 0);
});

test('extractText joins parts and reports why there is no text', () => {
  assert.equal(extractText({ candidates: [{ content: { parts: [{ text: 'Hi ' }, { text: 'there' }] } }] }), 'Hi there');
  assert.throws(() => extractText({ candidates: [{ finishReason: 'SAFETY' }] }), /finishReason: SAFETY/);
  assert.throws(() => extractText(null), /finishReason: none/);
});

/** @param {number} status @param {unknown} body */
const reply = (status, body) => ({
  ok: status < 400,
  status,
  json: async () => {
    if (body instanceof Error) throw body;
    return body;
  },
});

test('postJson returns data, surfaces server errors and handles offline', async () => {
  let seen;
  const ok = async (url, init) => {
    seen = { url, init };
    return reply(200, { plan: 1 });
  };
  assert.deepEqual(await postJson('/api/plan', { aqi: 1 }, ok), { plan: 1 });
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['content-type'], 'application/json');

  await assert.rejects(
    postJson('/x', {}, async () => reply(429, { error: 'Too many requests.' })),
    /Too many requests/,
  );
  await assert.rejects(
    postJson('/x', {}, async () => reply(500, new Error('bad json'))),
    /did not respond/,
  );
  await assert.rejects(
    postJson('/x', {}, async () => {
      throw new TypeError('offline');
    }),
    /did not respond/,
  );
});

test('requestPlan and askQuestion call the right endpoints', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, init) => {
    urls.push([url, JSON.parse(init.body)]);
    return reply(200, url === '/api/ask' ? { answer: { text: 'A', engine: 'rules' } } : { plan: {}, narration: {} });
  };
  try {
    await requestPlan({ city: 'Delhi', profile: { household: {}, lifestyle: {} } });
    const answer = await askQuestion({ aqi: 300, profile: { household: {}, lifestyle: {} } }, 'mask?', []);
    assert.equal(answer.text, 'A');
    assert.equal(urls[0][0], '/api/plan');
    assert.deepEqual(urls[1][1].question, 'mask?');
  } finally {
    globalThis.fetch = original;
  }
});
