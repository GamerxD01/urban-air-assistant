/**
 * GenAI layer (Google Gemini). The deterministic engine owns every number and every
 * recommendation; the model only (a) explains the plan in warm, plain language and
 * (b) answers follow-up questions, grounded strictly on that plan.
 * If no key is set or the call fails, the rule-based narrator keeps the app fully working.
 * @module services/llm
 */
import { GENAI } from '../config.js';
import { sanitizeText } from '../sanitize.js';
import { callGemini } from './gemini.js';
import { narrationPrompt, planForPrompt, questionPrompt } from './prompt.js';
import { ruleAnswer, ruleNarration } from './ruleNarrator.js';

export { sanitizeText, planForPrompt, ruleAnswer, ruleNarration };

/** @typedef {import('../types.js').Plan} Plan */
/** @typedef {import('../types.js').ChatTurn} ChatTurn */
/** @typedef {import('../types.js').Narration} Narration */

/**
 * @typedef {object} Assistant
 * @property {boolean} enabled whether Gemini is configured
 * @property {(plan: Plan) => Promise<Narration>} narrate
 * @property {(plan: Plan, question: string, history?: ChatTurn[]) => Promise<Narration>} ask
 */

/**
 * @param {{ apiKey?: string, model?: string, fetchImpl?: typeof fetch }} [options]
 * @returns {Assistant}
 */
export function createAssistant({ apiKey = '', model = GENAI.defaultModel, fetchImpl = fetch } = {}) {
  const enabled = Boolean(apiKey);

  /**
   * Runs Gemini, falling back to the rules narrator on any failure.
   * @param {string} prompt
   * @param {() => string} fallback
   * @returns {Promise<Narration>}
   */
  async function generate(prompt, fallback) {
    if (!enabled) return { text: fallback(), engine: 'rules' };
    try {
      return { text: await callGemini({ apiKey, model, prompt, fetchImpl }), engine: 'gemini' };
    } catch (err) {
      console.error(`[genai] falling back to rules: ${err instanceof Error ? err.message : String(err)}`);
      return { text: fallback(), engine: 'rules' };
    }
  }

  return {
    enabled,
    narrate: (plan) => generate(narrationPrompt(plan), () => ruleNarration(plan)),
    ask(plan, question, history = []) {
      const q = sanitizeText(question);
      return generate(questionPrompt(plan, q, history), () => ruleAnswer(plan, q));
    },
  };
}
