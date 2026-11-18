/**
 * Bounded in-memory cache with per-entry expiry. Oldest entries are evicted first when full,
 * so memory use stays flat however many cities are looked up.
 * @module lib/ttlCache
 */

/** @template V */
export class TtlCache {
  /** @type {Map<string, { at: number, value: V }>} */
  #entries = new Map();
  #ttlMs;
  #maxEntries;

  /**
   * @param {{ ttlMs: number, maxEntries: number }} options
   */
  constructor({ ttlMs, maxEntries }) {
    this.#ttlMs = ttlMs;
    this.#maxEntries = maxEntries;
  }

  /**
   * @param {string} key
   * @param {number} [now] current time in ms (injectable for tests)
   * @returns {V | undefined}
   */
  get(key, now = Date.now()) {
    const hit = this.#entries.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.#ttlMs) {
      this.#entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  /**
   * @param {string} key
   * @param {V} value
   * @param {number} [now]
   */
  set(key, value, now = Date.now()) {
    if (!this.#entries.has(key) && this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
    this.#entries.set(key, { at: now, value });
  }

  /** @returns {number} */
  get size() {
    return this.#entries.size;
  }

  clear() {
    this.#entries.clear();
  }
}
