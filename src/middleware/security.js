/** Dependency-free hardening middleware: headers, request guards and rate limiting. */

import { HSTS_MAX_AGE_SECONDS } from '../config.js';
import { Forbidden, UnsupportedMediaType } from '../errors.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  res.removeHeader('X-Powered-By');
  next();
}

/** API responses are personalised; never let a shared cache store them. */
export function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rejects cross-site browser requests to state-changing or paid endpoints.
 * Requests without an Origin header (server-to-server, curl, tests) are allowed.
 */
export function sameOriginOnly(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return next(new Forbidden('Cross-site requests are not allowed.'));
  }
  return originHost === req.get('host') ? next() : next(new Forbidden('Cross-site requests are not allowed.'));
}

/** Write endpoints only accept JSON, which also blocks simple form-encoded CSRF posts. */
export function requireJson(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method) || req.is('application/json')) return next();
  return next(new UnsupportedMediaType('Send the request as application/json.'));
}

/**
 * Fixed-window, per-IP rate limiter with an in-memory store that sweeps itself.
 * @param {{ windowMs?: number, max?: number, now?: () => number }} [opts]
 */
export function rateLimit({ windowMs = 60_000, max = 30, now = Date.now } = {}) {
  const hits = new Map();
  let lastSweep = now();

  return (req, res, next) => {
    const t = now();
    if (t - lastSweep > windowMs) {
      for (const [k, v] of hits) if (t - v.start > windowMs) hits.delete(k);
      lastSweep = t;
    }
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || t - entry.start > windowMs) {
      hits.set(key, { start: t, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - t) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    return next();
  };
}
