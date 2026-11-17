/** Small, dependency-free hardening middleware: security headers and a fixed-window rate limiter. */

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * @param {{ windowMs?: number, max?: number, now?: () => number }} opts
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
