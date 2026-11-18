/**
 * Page controller: wires the form, the API and the plan view together.
 * @module app
 */
import { askQuestion, requestPlan } from './api.js';
import { chatBlock } from './components/chat.js';
import { updateHero } from './components/hero.js';
import { $ } from './dom.js';
import { toPlanRequest, validatePlanRequest } from './format.js';
import { createHorizon } from './horizon.js';
import { renderPlan } from './render.js';

/** @typedef {import('./format.js').PlanRequest} PlanRequest */

const form = $('#plan-form');
const statusEl = $('#status');
const output = $('#plan-output');
const region = $('#plan-region');
const submitBtn = /** @type {HTMLButtonElement} */ ($('#submit-btn'));
const hero = { title: $('#hero-title'), reading: $('#hero-reading'), aqi: $('#hero-aqi'), detail: $('#hero-detail') };
const horizon = createHorizon($('#horizon'));
const VALIDATED_FIELDS = Object.freeze(['city', 'aqi']);
const SUBMIT_LABEL = "Build today's plan";

/**
 * @param {string} message
 * @param {boolean} [isError]
 */
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/** @param {boolean} busy */
function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? 'Reading the air...' : SUBMIT_LABEL;
  if (busy) region.setAttribute('aria-busy', 'true');
  else region.removeAttribute('aria-busy');
}

/** @returns {PlanRequest} */
function readRequest() {
  const data = new FormData(/** @type {HTMLFormElement} */ (form));
  return toPlanRequest((name) => {
    const value = data.get(name);
    return typeof value === 'string' ? value : null;
  });
}

/**
 * Marks the failing field, explains why and moves focus there.
 * @param {{ field: string, message: string }} problem
 */
function showProblem(problem) {
  setStatus(problem.message, true);
  const field = $(`#${problem.field}`);
  field.setAttribute('aria-invalid', 'true');
  field.focus();
}

/** @param {SubmitEvent} event */
async function onSubmit(event) {
  event.preventDefault();
  const request = readRequest();
  const problem = validatePlanRequest(request);
  if (problem) return showProblem(problem);
  for (const id of VALIDATED_FIELDS) $(`#${id}`).removeAttribute('aria-invalid');

  setBusy(true);
  setStatus("Looking up today's forecast and building your plan.");
  try {
    const { plan, narration } = await requestPlan(request);
    const chat = chatBlock({ ask: async (q, history) => (await askQuestion(request, q, history)).text });
    updateHero(hero, plan);
    horizon.setAir(plan.airQuality.pm25);
    output.replaceChildren(...renderPlan(plan, narration, chat));
    setStatus(`Plan ready for ${plan.airQuality.location?.name ?? 'your reading'}.`);
    region.focus();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    setBusy(false);
  }
}

/** Fills the form with an example household and submits it. */
function runExample() {
  const formEl = /** @type {HTMLFormElement} */ (form);
  /** @param {string} name */
  const field = (name) => /** @type {HTMLInputElement} */ (formEl.elements.namedItem(name));
  field('city').value = 'Delhi';
  field('children').checked = true;
  field('commute').value = 'car';
  field('commuteKm').value = '12';
  formEl.requestSubmit();
}

form.addEventListener('submit', (event) => void onSubmit(/** @type {SubmitEvent} */ (event)));
document.querySelector('#example-btn')?.addEventListener('click', runExample);
