/**
 * Thin client for the assistant's JSON API.
 * @module api
 */

/** @typedef {import('../../src/types.js').Plan} Plan */
/** @typedef {import('../../src/types.js').Narration} Narration */
/** @typedef {import('../../src/types.js').ChatTurn} ChatTurn */
/** @typedef {import('./format.js').PlanRequest} PlanRequest */

const OFFLINE_MESSAGE = 'The server did not respond. Check your connection and try again.';

/**
 * POSTs JSON and returns the parsed body, throwing the server's own error message on failure.
 * @param {string} path
 * @param {unknown} body
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<any>}
 */
export async function postJson(path, body, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(OFFLINE_MESSAGE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : OFFLINE_MESSAGE);
  return data;
}

/**
 * @param {PlanRequest} request
 * @returns {Promise<{ plan: Plan, narration: Narration }>}
 */
export const requestPlan = (request) => postJson('/api/plan', request);

/**
 * @param {PlanRequest} request
 * @param {string} question
 * @param {ChatTurn[]} history
 * @returns {Promise<Narration>}
 */
export async function askQuestion(request, question, history) {
  const { answer } = await postJson('/api/ask', { ...request, question, history });
  return answer;
}
