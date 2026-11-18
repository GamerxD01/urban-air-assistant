/**
 * Small DOM helpers. Elements are built with textContent and setAttribute only (never
 * innerHTML), so API data and model output can never inject markup.
 * @module dom
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @typedef {Record<string, string | number | boolean | null | undefined>} Attrs */
/** @typedef {Node | string | number | null | undefined | false} Child */

/**
 * querySelector that asserts the element exists (every selector used is a static ID in index.html).
 * @template {Element} [T=HTMLElement]
 * @param {string} selector
 * @returns {T}
 */
export function $(selector) {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return /** @type {T} */ (/** @type {unknown} */ (node));
}

/**
 * Creates an HTML element. `false`/`null`/`undefined` attributes and children are skipped;
 * `true` becomes an empty (boolean) attribute; strings become text nodes.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Attrs} [attrs]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (name === 'class') el.className = String(value);
    else el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return el;
}

/**
 * Creates an SVG element, optionally appending it to a parent.
 * @param {string} tag
 * @param {Attrs} [attrs]
 * @param {Element} [parent]
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, parent) {
  const el = /** @type {SVGElement} */ (document.createElementNS(SVG_NS, tag));
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== false) el.setAttribute(name, String(value));
  }
  parent?.append(el);
  return el;
}
