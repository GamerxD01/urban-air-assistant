/**
 * Normalisation of untrusted text.
 * @module sanitize
 */
import { LIMITS } from './config.js';

/**
 * Normalises untrusted text before it is used anywhere: strips control characters and any
 * tag that could break out of the prompt's <user_question>/<plan>/<system> framing,
 * collapses whitespace and caps the length.
 * @param {unknown} text
 * @param {number} [max]
 * @returns {string}
 */
export function sanitizeText(text, max = LIMITS.questionChars) {
  return (
    String(text ?? '')
      // Stripping control characters is the point of this regex.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/<\/?\s*(user_question|plan|system)[^>]*>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  );
}
