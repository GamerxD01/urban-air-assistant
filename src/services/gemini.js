/**
 * Minimal Google Gemini client (generateContent REST API). The API key travels in a header,
 * never in the URL, so it cannot leak into logs or proxies.
 * @module services/gemini
 */
import { GENAI } from '../config.js';
import { SYSTEM_PROMPT } from './prompt.js';

/** Longest slice of Google's error body kept for the server log. */
const ERROR_DETAIL_CHARS = 300;

/**
 * @param {string} model
 * @returns {string}
 */
const endpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

/**
 * @typedef {object} GeminiRequest
 * @property {string} apiKey
 * @property {string} model
 * @property {string} prompt
 * @property {typeof fetch} fetchImpl
 */

/**
 * Pulls the text out of a generateContent response.
 * @param {any} data parsed response body
 * @returns {string}
 * @throws {Error} when the model returned no text (blocked, truncated or empty)
 */
export function extractText(data) {
  /** @type {{ text?: string }[]} */
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error(`Gemini returned no text (finishReason: ${data?.candidates?.[0]?.finishReason ?? 'none'})`);
  }
  return text;
}

/**
 * Sends one prompt and returns the model's text.
 * @param {GeminiRequest} request
 * @returns {Promise<string>}
 * @throws {Error} on HTTP errors, timeouts or empty responses
 */
export async function callGemini({ apiKey, model, prompt, fetchImpl }) {
  const res = await fetchImpl(endpoint(model), {
    method: 'POST',
    signal: AbortSignal.timeout(GENAI.timeoutMs),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: GENAI.maxOutputTokens,
        thinkingConfig: { thinkingLevel: GENAI.thinkingLevel },
      },
    }),
  });
  if (!res.ok) {
    // Google's error body explains the cause (bad key, unknown model, quota) and never echoes the key.
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini responded ${res.status}: ${detail.slice(0, ERROR_DETAIL_CHARS)}`);
  }
  return extractText(await res.json());
}
