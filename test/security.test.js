import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/createApp.js';
import { createAssistant } from '../src/services/llm.js';

let server;
let base;

before(async () => {
  const app = createApp({
    assistant: createAssistant(),
    airQualityForCity: async () => ({ hourly: Array(24).fill(150), source: 'test', location: { name: 'Testpur' } }),
    rateLimits: { api: { max: 1000 }, genai: { max: 1000 } },
    trustProxy: false,
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const json = (headers = {}) => ({ 'content-type': 'application/json', ...headers });

test('API responses are never cached', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('security headers include HSTS, CSP font/object rules and CORP', async () => {
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get('strict-transport-security'), /max-age=\d+/);
  assert.match(res.headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});

test('cross-site browser POSTs are rejected with 403', async () => {
  const res = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: json({ origin: 'https://evil.example' }),
    body: JSON.stringify({ aqi: 200 }),
  });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Cross-site/);
});

test('malformed Origin headers are rejected', async () => {
  const res = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: json({ origin: 'not a url' }),
    body: JSON.stringify({ aqi: 200 }),
  });
  assert.equal(res.status, 403);
});

test('same-origin browser POSTs are allowed', async () => {
  const res = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: json({ origin: base }),
    body: JSON.stringify({ aqi: 200 }),
  });
  assert.equal(res.status, 200);
});

test('non-JSON POST bodies get 415 (blocks form-encoded CSRF)', async () => {
  const res = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'aqi=200',
  });
  assert.equal(res.status, 415);
});

test('GenAI endpoints have their own, tighter rate limit', async () => {
  const app = createApp({
    assistant: createAssistant(),
    rateLimits: { api: { max: 1000 }, genai: { max: 3 } },
    trustProxy: false,
  });
  const isolated = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const url = `http://127.0.0.1:${isolated.address().port}`;
  try {
    const statuses = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await fetch(`${url}/api/ask`, {
        method: 'POST',
        headers: json(),
        body: JSON.stringify({ aqi: 200, question: 'mask?' }),
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
    assert.equal((await fetch(`${url}/api/health`)).status, 200, 'cheap endpoints are unaffected');
  } finally {
    await new Promise((resolve) => isolated.close(resolve));
  }
});

test('trust proxy is enabled only when asked', () => {
  assert.equal(createApp({ trustProxy: true }).get('trust proxy'), 1);
  assert.equal(createApp({ trustProxy: false }).get('trust proxy'), false);
});
