import { LIMITS } from './config.js';
import { BadRequest } from './errors.js';
import { sanitizeText } from './sanitize.js';

/**
 * @typedef {{ city: string, aqi: number | undefined, pm25: number | undefined }} AirInput
 * @typedef {{ role: 'user' | 'assistant', text: string }} ChatTurn
 */

/**
 * @param {unknown} body
 * @returns {Record<string, unknown>}
 */
export function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('Send a JSON object.');
  return /** @type {Record<string, unknown>} */ (body);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} max
 * @returns {number | undefined}
 */
function optionalNumber(value, field, max) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequest(`${field} must be a number between 0 and ${max}.`);
  return n;
}

/**
 * Validates the air-quality part of a request body.
 * @param {Record<string, unknown>} body
 * @returns {AirInput}
 */
export function parseAirInput(body) {
  const city = typeof body.city === 'string' ? sanitizeText(body.city, LIMITS.cityChars) : '';
  const aqi = optionalNumber(body.aqi, 'aqi', LIMITS.maxAqi);
  const pm25 = optionalNumber(body.pm25, 'pm25', LIMITS.maxPm25);
  if (!city && aqi === undefined && pm25 === undefined) {
    throw new BadRequest('Provide a city, or an AQI / PM2.5 value.');
  }
  return { city, aqi, pm25 };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function parseQuestion(value) {
  const question = sanitizeText(value, LIMITS.questionChars);
  if (question.length < LIMITS.minQuestionChars) throw new BadRequest('Please type a question.');
  return question;
}

/**
 * Keeps only well-formed chat turns, newest last, capped in count and length.
 * @param {unknown} value
 * @returns {ChatTurn[]}
 */
export function parseHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t) => t && typeof t.text === 'string' && (t.role === 'user' || t.role === 'assistant'))
    .slice(-LIMITS.historyTurns)
    .map((t) => ({ role: t.role, text: sanitizeText(t.text, LIMITS.historyChars) }));
}
