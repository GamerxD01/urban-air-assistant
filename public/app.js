import { h, renderPlan, chatMessage, BAND_VARS } from './render.js';
import { createHorizon } from './horizon.js';

const form = document.getElementById('plan-form');
const statusEl = document.getElementById('status');
const output = document.getElementById('plan-output');
const region = document.getElementById('plan-region');
const submitBtn = document.getElementById('submit-btn');
const heroTitle = document.getElementById('hero-title');
const heroReading = document.getElementById('hero-reading');
const heroAqi = document.getElementById('hero-aqi');
const heroDetail = document.getElementById('hero-detail');
const horizon = createHorizon(document.getElementById('horizon'));

const SUGGESTIONS = ['Which mask should we buy?', 'Can the kids play outside today?', 'How do I clean the air in one room cheaply?', 'Is changing my commute worth it?'];

let lastRequest = null;
let history = [];

function readRequest() {
  const fd = new FormData(form);
  const box = (name) => fd.get(name) === 'on';
  const req = {
    profile: {
      household: { children: box('children'), elderly: box('elderly'), respiratory: box('respiratory'), pregnant: box('pregnant'), outdoorWorker: box('outdoorWorker') },
      lifestyle: { commute: fd.get('commute'), commuteKm: fd.get('commuteKm'), cooking: fd.get('cooking'), heating: fd.get('heating'), hasPurifier: box('hasPurifier') },
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
  if (!res.ok) throw new Error(data.error || 'The server did not respond. Check your connection and try again.');
  return data;
}

function updateHero(plan) {
  const air = plan.airQuality;
  const place = air.location?.name?.split(',')[0] ?? 'Your area';
  heroTitle.textContent = `${place}: ${air.band.label.toLowerCase()} air today.`;
  heroAqi.textContent = String(air.aqi);
  heroAqi.style.setProperty('--band', `var(${BAND_VARS[air.band.index]})`);
  heroDetail.textContent = `PM2.5 averages ${air.pm25} µg/m³. Household risk: ${plan.risk.label.toLowerCase()}.`;
  heroReading.hidden = false;
  horizon.setAir(air.pm25);
}

function chatBlock() {
  const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Answers to your questions' });
  const input = h('input', { id: 'chat-input', type: 'text', maxlength: '400', autocomplete: 'off', placeholder: 'Should the purifier run all night?' });
  const send = h('button', { type: 'submit' }, 'Ask');
  const chips = h('div', { class: 'chips' }, SUGGESTIONS.map((q) => h('button', { type: 'button', class: 'chip' }, q)));

  const ask = async (question) => {
    const q = question.trim();
    if (!q || !lastRequest) return;
    log.append(chatMessage('user', q));
    input.value = '';
    send.disabled = true;
    send.textContent = 'Asking...';
    try {
      const { answer } = await post('/api/ask', { ...lastRequest, question: q, history });
      history.push({ role: 'user', text: q }, { role: 'assistant', text: answer.text });
      log.append(chatMessage('bot', answer.text));
    } catch (err) {
      log.append(chatMessage('bot', err.message));
    } finally {
      send.disabled = false;
      send.textContent = 'Ask';
      log.scrollTop = log.scrollHeight;
    }
  };

  chips.addEventListener('click', (e) => { if (e.target instanceof HTMLButtonElement) ask(e.target.textContent); });
  const chatForm = h('form', { class: 'chat-row' }, h('label', { for: 'chat-input', class: 'sr-only' }, 'Your question'), input, send);
  chatForm.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

  return h('section', { class: 'block', 'aria-labelledby': 'chat-title' },
    h('h3', { id: 'chat-title' }, 'Ask about your plan'),
    h('p', { class: 'lede' }, 'Answers use only the numbers in your plan.'),
    chips, log, chatForm);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const req = readRequest();
  if (!req.city && req.aqi === undefined) {
    setStatus('Type a city, or open "Enter the AQI from your phone instead".', true);
    document.getElementById('city').focus();
    return;
  }
  if (req.aqi !== undefined && !(req.aqi >= 0 && req.aqi <= 500)) {
    setStatus('The AQI needs to be a number from 0 to 500.', true);
    document.getElementById('aqi').focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Reading the air...';
  setStatus('Looking up today\'s forecast and building your plan.');
  try {
    const { plan, narration } = await post('/api/plan', req);
    lastRequest = req;
    history = [];
    updateHero(plan);
    output.replaceChildren(...renderPlan(plan, narration), chatBlock(), h('p', { class: 'disclaimer' }, plan.disclaimer));
    setStatus(`Plan ready for ${plan.airQuality.location?.name ?? 'your reading'}.`);
    region.focus();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Build today\'s plan';
  }
});

document.getElementById('example-btn')?.addEventListener('click', () => {
  form.elements.city.value = 'Delhi';
  form.elements.children.checked = true;
  form.elements.commute.value = 'car';
  form.elements.commuteKm.value = '12';
  form.requestSubmit();
});
