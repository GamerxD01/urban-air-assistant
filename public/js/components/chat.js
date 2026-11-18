/**
 * "Ask about your plan": follow-up questions answered from the plan's numbers.
 * The component owns its conversation history; the network call is injected.
 * @module components/chat
 */
import { h } from '../dom.js';

/** @typedef {import('../../../src/types.js').ChatTurn} ChatTurn */

export const SUGGESTIONS = Object.freeze([
  'Which mask should we buy?',
  'Can the kids play outside today?',
  'How do I clean the air in one room cheaply?',
  'Is changing my commute worth it?',
]);

/**
 * @param {'user' | 'assistant'} role
 * @param {string} text
 * @returns {HTMLDivElement}
 */
export function chatMessage(role, text) {
  return h('div', { class: `msg ${role === 'user' ? 'user' : 'bot'}` }, text);
}

/**
 * @param {{ ask: (question: string, history: ChatTurn[]) => Promise<string> }} deps
 * @returns {HTMLElement}
 */
export function chatBlock({ ask }) {
  /** @type {ChatTurn[]} */
  const history = [];
  const log = h('div', {
    class: 'chat-log',
    role: 'log',
    'aria-live': 'polite',
    'aria-label': 'Answers to your questions',
  });
  const input = h('input', {
    id: 'chat-input',
    type: 'text',
    maxlength: 400,
    autocomplete: 'off',
    placeholder: 'Should the purifier run all night?',
  });
  const send = h('button', { type: 'submit' }, 'Ask');
  const chips = h(
    'div',
    { class: 'chips' },
    SUGGESTIONS.map((q) => h('button', { type: 'button', class: 'chip' }, q)),
  );

  /** @param {string} raw */
  const submit = async (raw) => {
    const question = raw.trim();
    if (!question) return;
    log.append(chatMessage('user', question));
    input.value = '';
    send.disabled = true;
    send.textContent = 'Asking...';
    try {
      const answer = await ask(question, [...history]);
      history.push({ role: 'user', text: question }, { role: 'assistant', text: answer });
      log.append(chatMessage('assistant', answer));
    } catch (err) {
      log.append(chatMessage('assistant', err instanceof Error ? err.message : String(err)));
    } finally {
      send.disabled = false;
      send.textContent = 'Ask';
      log.scrollTop = log.scrollHeight;
    }
  };

  chips.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement) void submit(target.textContent ?? '');
  });
  const form = h(
    'form',
    { class: 'chat-row' },
    h('label', { for: 'chat-input', class: 'sr-only' }, 'Your question'),
    input,
    send,
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit(input.value);
  });

  return h(
    'section',
    { class: 'block', 'aria-labelledby': 'chat-title' },
    h('h3', { id: 'chat-title' }, 'Ask about your plan'),
    h('p', { class: 'lede' }, 'Answers use only the numbers in your plan.'),
    chips,
    log,
    form,
  );
}
