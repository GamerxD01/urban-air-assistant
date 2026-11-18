/**
 * Turns errors into safe JSON responses.
 * @module middleware/errorHandler
 */
import { HttpError, UpstreamError } from '../errors.js';

const MANUAL_HINT = ' You can still enter the AQI shown on your phone manually.';

/**
 * JSON 404 for unknown API routes.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

/**
 * Maps known errors to safe JSON responses; unknown errors are logged and hidden behind a 500.
 * Express recognises error middleware by its four parameters, so `next` must stay.
 * @param {any} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (err instanceof UpstreamError) {
    const hint = err.status === 404 ? '' : MANUAL_HINT;
    return res.status(err.status).json({ error: `${err.message}${hint}` });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
