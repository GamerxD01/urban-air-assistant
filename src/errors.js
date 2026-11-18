/**
 * Error types that map to HTTP responses. Anything that is not an HttpError is treated as
 * an unexpected bug and answered with a generic 500, so internals never leak to clients.
 * @module errors
 */

export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code to answer with
   * @param {string} message safe, user-facing message
   */
  constructor(status, message) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class BadRequest extends HttpError {
  /** @param {string} message */
  constructor(message) {
    super(400, message);
  }
}

export class Forbidden extends HttpError {
  /** @param {string} message */
  constructor(message) {
    super(403, message);
  }
}

export class UnsupportedMediaType extends HttpError {
  /** @param {string} message */
  constructor(message) {
    super(415, message);
  }
}

/** The air-quality provider failed or returned nothing usable. */
export class UpstreamError extends HttpError {
  /**
   * @param {string} message
   * @param {number} [status]
   */
  constructor(message, status = 502) {
    super(status, message);
  }
}
