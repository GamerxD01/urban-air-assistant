/**
 * Fills `{name}` placeholders in advice copy (see data/advice.js).
 * @module engine/template
 */

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Replaces every `{name}` with `vars[name]`.
 * @param {string} template
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 * @throws {Error} when a placeholder has no value, so broken copy fails loudly in tests
 */
export function fillTemplate(template, vars = {}) {
  return template.replace(PLACEHOLDER, (_match, name) => {
    if (!(name in vars)) throw new Error(`Missing value for {${name}} in advice template`);
    return String(vars[name]);
  });
}

/**
 * Turns an advice template into a concrete item for this household.
 * @param {import('../data/advice.js').AdviceTemplate} template
 * @param {Record<string, string | number>} [vars]
 * @returns {import('../types.js').Item}
 */
export function adviceItem(template, vars = {}) {
  /** @type {import('../types.js').Item} */
  const item = {
    id: fillTemplate(template.id, vars),
    tag: template.tag,
    title: fillTemplate(template.title, vars),
    why: fillTemplate(template.why, vars),
  };
  if (template.detail !== undefined) item.detail = fillTemplate(template.detail, vars);
  if (template.when !== undefined) item.when = fillTemplate(template.when, vars);
  return item;
}
