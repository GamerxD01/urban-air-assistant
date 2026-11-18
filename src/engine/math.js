/**
 * Small numeric helpers shared by the engine.
 * @module engine/math
 */

/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number} n limited to [lo, hi]
 */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * @param {number[]} xs non-empty list
 * @returns {number} arithmetic mean
 */
export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * @param {number} n
 * @returns {number} n rounded to 1 decimal place
 */
export const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {number} n
 * @returns {number} n rounded to 2 decimal places
 */
export const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Percentage change from `base` to `value`, rounded; 0 when base is 0.
 * @param {number} value
 * @param {number} base
 * @returns {number}
 */
export const pctChange = (value, base) => (base > 0 ? Math.round(((value - base) / base) * 100) : 0);
