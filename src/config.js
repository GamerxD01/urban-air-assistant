/**
 * Every tunable limit in one place, so behaviour can be reviewed and changed without
 * hunting for magic numbers across modules.
 */

/** Input size limits for anything a client can send. */
export const LIMITS = Object.freeze({
  bodySize: '16kb',
  cityChars: 80,
  questionChars: 400,
  minQuestionChars: 2,
  historyTurns: 6,
  historyChars: 600,
  maxAqi: 999,
  maxPm25: 1000,
});

/** Per-IP request budgets. GenAI calls cost money, so they get a tighter budget. */
export const RATE_LIMITS = Object.freeze({
  api: { windowMs: 60_000, max: 30 },
  genai: { windowMs: 60_000, max: 10 },
});

/** Open-Meteo client behaviour. */
export const UPSTREAM = Object.freeze({
  timeoutMs: 6_000,
  cacheTtlMs: 15 * 60 * 1000,
  cacheMax: 200,
});

/** Gemini client behaviour. */
export const GENAI = Object.freeze({
  defaultModel: 'gemini-3.8-flash',
  timeoutMs: 20_000,
  // Short, grounded explanations need little reasoning; "low" keeps latency well under the timeout.
  // Temperature is left at the model default, as Google recommends for Gemini 3 models.
  thinkingLevel: 'low',
  maxOutputTokens: 2048,
});

export const STATIC_CACHE_MAX_AGE = '1h';
export const HSTS_MAX_AGE_SECONDS = 63_072_000;
