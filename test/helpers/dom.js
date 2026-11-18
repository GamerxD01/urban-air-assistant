/**
 * Installs a lightweight DOM (linkedom) as browser globals so UI components can be tested in Node.
 * Import this module before importing any component.
 * @module test/helpers/dom
 */
import { parseHTML } from 'linkedom';

const { window, document } = parseHTML('<!doctype html><html lang="en"><body></body></html>');

for (const [name, value] of Object.entries({
  window,
  document,
  Node: window.Node,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: window.HTMLButtonElement,
  Event: window.Event,
})) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/** @returns {HTMLElement} a fresh container attached to the document */
export function mount() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  return root;
}
