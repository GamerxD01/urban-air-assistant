/**
 * JSON API: /api/health, /api/plan and /api/ask.
 * @module routes/api
 */
import express from 'express';
import { RATE_LIMITS } from '../config.js';
import { noStore, rateLimit, requireJson, sameOriginOnly } from '../middleware/security.js';
import { parseHistory, parseQuestion } from '../validation.js';

/**
 * Wraps an async handler so rejected promises reach the error middleware.
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<unknown>} fn
 * @returns {import('express').RequestHandler}
 */
const handle = (fn) => (req, res, next) => {
  fn(req, res).catch(next);
};

/**
 * @param {{
 *   assistant: import('../services/llm.js').Assistant,
 *   planService: ReturnType<typeof import('../services/planService.js').createPlanService>,
 *   rateLimits?: { api?: { windowMs?: number, max?: number }, genai?: { windowMs?: number, max?: number } },
 * }} deps
 * @returns {import('express').Router}
 */
export function createApiRouter({ assistant, planService, rateLimits = {} }) {
  const router = express.Router();
  const genaiLimit = rateLimit({ ...RATE_LIMITS.genai, ...rateLimits.genai });

  router.use(noStore, sameOriginOnly, requireJson, rateLimit({ ...RATE_LIMITS.api, ...rateLimits.api }));

  router.get('/health', (req, res) => {
    res.json({ ok: true, genai: assistant.enabled });
  });

  router.post(
    '/plan',
    genaiLimit,
    handle(async (req, res) => {
      const plan = await planService.planFromBody(req.body);
      const narration = await assistant.narrate(plan);
      res.json({ plan, narration });
    }),
  );

  router.post(
    '/ask',
    genaiLimit,
    handle(async (req, res) => {
      const question = parseQuestion(req.body?.question);
      const history = parseHistory(req.body?.history);
      const plan = await planService.planFromBody(req.body);
      const answer = await assistant.ask(plan, question, history);
      res.json({ answer });
    }),
  );

  return router;
}
