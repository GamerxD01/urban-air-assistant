import { h, renderPlan, chatMessage } from './render.js';

const form = document.getElementById('plan-form');
const statusEl = document.getElementById('status');
const output = document.getElementById('plan-output');
const region = document.getElementById('plan-region');
const submitBtn = document.getElementById('submit-btn');

const SUGGESTIONS = ['Which mask should I buy?', 'Is it safe for the kids to play outside?', 'How do I clean my room air cheaply?', 'Is switching my commute worth it?'];

let lastRequest = null;
let history = [];

function readRequest() {
  const fd = new FormData(form);
  const box = (name) => fd.get(name) === 'on';
  const req = {
    profile: {
      household: { children: box('children'), elderly: box('elderly'), respiratory: box('respiratory'), pregnant: box('pregnant'), outdoorWorker: box('outdoorWorker') },
      lifestyle: {
        commute: fd.get('commute'),
        commuteKm: fd.get('commuteKm'),
        cooking: fd.get('cooking'),
        heating: fd.get('heating'),
        hasPurifier: box('hasPurifier'),
      },
    },
  };
  const city = String(fd.get('city') ?? '').trim();
  const aqi = String(fd.get('aqi') ?? '').trim();
  if (city) req.city = city;
  if (aqi) req.aqi = Number(aqi);
  return req;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function chatCard() {
  const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  const input = h('input', { id: 'chat-input', type: 'text', maxlength: '400', autocomplete: 'off', placeholder: 'e.g. Should I run an air purifier all night?' });
  const send = h('button', { type: 'submit', class: 'secondary' }, 'Ask');
  const chips = h('div', { class: 'chips' }, SUGGESTIONS.map((s) => h('button', { type: 'button', class: 'chip' }, s)));

  const ask = async (question) => {
    const q = question.trim();
    if (!q || !lastRequest) return;
    log.append(chatMessage('user', q));
    input.value = '';
    send.disabled = true;
    try {
      const { answer } = await post('/api/ask', { ...lastRequest, question: q, history });
      history.push({ role: 'user', text: q }, { role: 'assistant', text: answer.text });
      log.append(chatMessage('bot', answer.text));
    } catch (err) {
      log.append(chatMessage('bot', err.message));
    } finally {
      send.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  };

  chips.addEventListener('click', (e) => { if (e.target instanceof HTMLButtonElement) ask(e.target.textContent); });
  const chatForm = h('form', { class: 'chat-row' }, h('label', { for: 'chat-input', class: 'sr-only' }, 'Ask a follow-up question'), input, send);
  chatForm.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

  return h('section', { class: 'card', 'aria-labelledby': 'chat-title' }, h('h3', { id: 'chat-title' }, 'Ask a follow-up'), chips, log, chatForm);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const req = readRequest();
  if (!req.city && req.aqi === undefined) {
    setStatus('Enter a city, or open the manual option and type your AQI.', true);
    document.getElementById('city').focus();
    return;
  }
  if (req.aqi !== undefined && !(req.aqi >= 0 && req.aqi <= 500)) {
    setStatus('AQI must be a number between 0 and 500.', true);
    document.getElementById('aqi').focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus('Fetching live air quality and building your plan...');
  try {
    const { plan, narration } = await post('/api/plan', req);
    lastRequest = req;
    history = [];
    output.replaceChildren(...renderPlan(plan, narration), chatCard());
    setStatus(`Plan ready for ${plan.airQuality.location?.name ?? 'your reading'}.`);
    region.focus({ preventScroll: false });
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});
