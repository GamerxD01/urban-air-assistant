import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildPlan } from './engine/plan.js';
import { airQualityForCity, UpstreamError } from './services/airQuality.js';
import { createAssistant, sanitizeText } from './services/llm.js';
import { securityHeaders, rateLimit } from './middleware/security.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MAX_CITY_CHARS = 80;

class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const optionalNumber = (value, field, max) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequest(`${field} must be a number between 0 and ${max}.`);
  return n;
};

/** Validates the air-quality part of a request body. */
export function parseAirInput(body) {
  const city = typeof body.city === 'string' ? sanitizeText(body.city, MAX_CITY_CHARS) : '';
  const aqi = optionalNumber(body.aqi, 'aqi', 999);
  const pm25 = optionalNumber(body.pm25, 'pm25', 1000);
  if (!city && aqi === undefined && pm25 === undefined) {
    throw new BadRequest('Provide a city, or an AQI / PM2.5 value.');
  }
  return { city, aqi, pm25 };
}

async function resolveAirQuality({ city, aqi, pm25 }, deps) {
  if (city) {
    try {
      return await deps.airQualityForCity(city);
    } catch (err) {
      const manual = aqi !== undefined || pm25 !== undefined;
      if (!(err instanceof UpstreamError) || !manual) throw err;
      // Live lookup failed but the user also supplied a reading: continue with it.
    }
  }
  return { pm25, aqi, source: 'manual', location: city ? { name: city } : null };
}

/**
 * @param {{ assistant?: ReturnType<typeof createAssistant>, airQualityForCity?: Function, rateLimitMax?: number }} deps
 */
export function createApp(deps = {}) {
  const assistant = deps.assistant ?? createAssistant();
  const lookup = { airQualityForCity: deps.airQualityForCity ?? airQualityForCity };

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: 'index.html' }));

  const api = express.Router();
  api.use(rateLimit({ max: deps.rateLimitMax ?? 30 }));

  api.get('/health', (req, res) => res.json({ ok: true, genai: assistant.enabled }));

  async function planFromBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('Send a JSON object.');
    const airInput = parseAirInput(body);
    const air = await resolveAirQuality(airInput, lookup);
    return buildPlan({ airQuality: air, profile: body.profile });
  }

  api.post('/plan', async (req, res, next) => {
    try {
      const plan = await planFromBody(req.body);
      const narration = await assistant.narrate(plan);
      res.json({ plan, narration });
    } catch (err) {
      next(err);
    }
  });

  api.post('/ask', async (req, res, next) => {
    try {
      const question = sanitizeText(req.body?.question);
      if (question.length < 2) throw new BadRequest('Please type a question.');
      const history = Array.isArray(req.body?.history)
        ? req.body.history.filter((t) => t && typeof t.text === 'string' && ['user', 'assistant'].includes(t.role))
        : [];
      const plan = await planFromBody(req.body);
      const answer = await assistant.ask(plan, question, history);
      res.json({ answer });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (err instanceof SyntaxError || err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    if (err instanceof UpstreamError) {
      const hint = err.status === 404 ? '' : ' You can still enter the AQI shown on your phone manually.';
      return res.status(err.status).json({ error: `${err.message}${hint}` });
    }
    if (err instanceof TypeError) return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
