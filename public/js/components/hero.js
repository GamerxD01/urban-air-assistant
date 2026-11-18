/**
 * The hero reading under the skyline: "Delhi: severe air today." with the AQI and its band colour.
 * @module components/hero
 */
import { BAND_VARS } from '../format.js';

/** @typedef {import('../../../src/types.js').Plan} Plan */

/**
 * @typedef {object} HeroRefs
 * @property {HTMLElement} title
 * @property {HTMLElement} reading
 * @property {HTMLElement} aqi
 * @property {HTMLElement} detail
 */

/**
 * @param {Plan} plan
 * @returns {{ title: string, aqi: string, detail: string, bandVar: string }}
 */
export function heroContent(plan) {
  const air = plan.airQuality;
  const place = air.location?.name?.split(',')[0] ?? 'Your area';
  return {
    title: `${place}: ${air.band.label.toLowerCase()} air today.`,
    aqi: String(air.aqi),
    detail: `PM2.5 averages ${air.pm25} µg/m³. Household risk: ${plan.risk.label.toLowerCase()}.`,
    bandVar: `var(${BAND_VARS[air.band.index]})`,
  };
}

/**
 * @param {HeroRefs} refs
 * @param {Plan} plan
 */
export function updateHero(refs, plan) {
  const content = heroContent(plan);
  refs.title.textContent = content.title;
  refs.aqi.textContent = content.aqi;
  refs.aqi.style.setProperty('--band', content.bandVar);
  refs.detail.textContent = content.detail;
  refs.reading.hidden = false;
}
