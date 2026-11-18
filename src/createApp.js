import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { LIMITS, STATIC_CACHE_MAX_AGE } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/security.js';
import { createApiRouter } from './routes/api.js';
import { airQualityForCity } from './services/airQuality.js';
import { createAssistant } from './services/llm.js';
import { createPlanService } from './services/planService.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Composition root: wires middleware, routes and services together.
 * Every external dependency can be swapped out, which is how the tests run offline.
 *
 * @param {{
 *   assistant?: ReturnType<typeof createAssistant>,
 *   airQualityForCity?: (city: string) => Promise<object>,
 *   rateLimits?: { api?: object, genai?: object },
 *   trustProxy?: boolean,
 * }} [deps]
 */
export function createApp(deps = {}) {
  const assistant = deps.assistant ?? createAssistant();
  const planService = createPlanService({ airQualityForCity: deps.airQualityForCity ?? airQualityForCity });
  const trustProxy = deps.trustProxy ?? (process.env.TRUST_PROXY === '1' || Boolean(process.env.VERCEL));

  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: LIMITS.bodySize }));
  app.use(express.static(PUBLIC_DIR, { maxAge: STATIC_CACHE_MAX_AGE, index: 'index.html' }));

  app.use('/api', createApiRouter({ assistant, planService, rateLimits: deps.rateLimits }));
  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
