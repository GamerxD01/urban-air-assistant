import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, parseAirInput } from '../src/app.js';
import { createAssistant } from '../src/services/llm.js';
import { UpstreamError } from '../src/services/airQuality.js';
import { rateLimit } from '../src/middleware/security.js';

let server;
let base;
let lookupBehaviour;

before(async () => {
  const app = createApp({
    assistant: createAssistant(),
    airQualityForCity: async (city) => lookupBehaviour(city),
    rateLimitMax: 1000,
  });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = (path, body, raw = false) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) });

test('GET /api/health reports GenAI status', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, genai: false });
});

test('POST /api/plan with a manual AQI returns a full plan and narration', async () => {
  const res = await post('/api/plan', { aqi: 320, profile: { household: { children: true } } });
  assert.equal(res.status, 200);
  const { plan, narration } = await res.json();
  assert.equal(plan.airQuality.aqi, 320);
  assert.ok(plan.routine.length > 0 && plan.indoor.length > 0 && plan.sustainable.length > 0);
  assert.equal(narration.engine, 'rules');
});

test('POST /api/plan with a city uses the live lookup', async () => {
  lookupBehaviour = async (city) => ({ hourly: Array(24).fill(120), source: 'open-meteo', location: { name: `${city}, India` } });
  const res = await post('/api/plan', { city: 'Kanpur' });
  const { plan } = await res.json();
  assert.equal(plan.airQuality.location.name, 'Kanpur, India');
  assert.equal(plan.airQuality.pm25, 120);
  assert.equal(plan.airQuality.hourlyIsEstimated, false);
});

test('city lookup failure falls back to a manual AQI when one was supplied', async () => {
  lookupBehaviour = async () => { throw new UpstreamError('down'); };
  const res = await post('/api/plan', { city: 'Agra', aqi: 250 });
  assert.equal(res.status, 200);
  const { plan } = await res.json();
  assert.equal(plan.airQuality.aqi, 250);
  assert.equal(plan.airQuality.location.name, 'Agra');
});

test('city lookup failure without a manual reading returns a helpful error', async () => {
  lookupBehaviour = async () => { throw new UpstreamError('The air-quality service could not be reached.'); };
  const res = await post('/api/plan', { city: 'Agra' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /enter the AQI/i);
});

test('unknown places return 404 without the manual hint', async () => {
  lookupBehaviour = async () => { throw new UpstreamError('No place found for "zzz".', 404); };
  const res = await post('/api/plan', { city: 'zzz' });
  assert.equal(res.status, 404);
});

test('input validation rejects bad payloads with 400', async () => {
  for (const body of [{}, { aqi: -1 }, { aqi: 'abc' }, { aqi: 5000 }, { pm25: 99999 }, []]) {
    const res = await post('/api/plan', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await post('/api/plan', '{not json', true)).status, 400);
});

test('oversized bodies are rejected with 413', async () => {
  const res = await post('/api/plan', { aqi: 100, junk: 'x'.repeat(20_000) });
  assert.equal(res.status, 413);
});

test('POST /api/ask answers a follow-up grounded in the plan', async () => {
  const res = await post('/api/ask', { aqi: 300, question: 'Which mask should I wear?', profile: { household: { respiratory: true } }, history: [{ role: 'user', text: 'hi' }, { role: 'bogus', text: 'x' }] });
  assert.equal(res.status, 200);
  const { answer } = await res.json();
  assert.match(answer.text, /N95|FFP2|mask/i);
});

test('POST /api/ask rejects an empty question', async () => {
  assert.equal((await post('/api/ask', { aqi: 300, question: ' ' })).status, 400);
});

test('static page and security headers are served', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<html lang="en">/);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('unknown API routes return JSON 404', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found.' });
});

test('parseAirInput trims and validates', () => {
  assert.deepEqual(parseAirInput({ city: '  Delhi  ', aqi: '120' }), { city: 'Delhi', aqi: 120, pm25: undefined });
  assert.throws(() => parseAirInput({ city: '   ' }), /Provide a city/);
});

test('rate limiter blocks after the quota and resets next window', () => {
  let t = 0;
  const limiter = rateLimit({ windowMs: 1000, max: 2, now: () => t });
  const run = () => {
    const out = { status: 200, headers: {} };
    const res = { set: (k, v) => { out.headers[k] = v; }, status(s) { out.status = s; return this; }, json() { return this; } };
    let passed = false;
    limiter({ ip: '1.2.3.4' }, res, () => { passed = true; });
    return { passed, ...out };
  };
  assert.equal(run().passed, true);
  assert.equal(run().passed, true);
  const blocked = run();
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers['Retry-After']);
  t = 1500;
  assert.equal(run().passed, true);
});
