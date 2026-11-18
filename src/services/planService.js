/**
 * Request body → validated input → live air quality → plan.
 * @module services/planService
 */
import { buildPlan } from '../engine/plan.js';
import { BadRequest, UpstreamError } from '../errors.js';
import { parseAirInput, requireObject } from '../validation.js';

/**
 * Turns a raw request body into a plan: validate → resolve live air quality → run the engine.
 * The air-quality lookup is injected so routes and tests never depend on the network.
 *
 * @param {{ airQualityForCity: (city: string) => Promise<object> }} deps
 */
export function createPlanService({ airQualityForCity }) {
  /** @param {import('../validation.js').AirInput} input */
  async function resolveAirQuality({ city, aqi, pm25 }) {
    if (city) {
      try {
        return await airQualityForCity(city);
      } catch (err) {
        const hasManualReading = aqi !== undefined || pm25 !== undefined;
        if (!(err instanceof UpstreamError) || !hasManualReading) throw err;
        // The live lookup failed but the user also typed a reading: carry on with it.
      }
    }
    return { pm25, aqi, source: 'manual', location: city ? { name: city } : null };
  }

  return {
    /**
     * @param {unknown} rawBody
     * @returns {Promise<ReturnType<typeof buildPlan>>}
     */
    async planFromBody(rawBody) {
      const body = requireObject(rawBody);
      const air = await resolveAirQuality(parseAirInput(body));
      try {
        return buildPlan({ airQuality: air, profile: body.profile });
      } catch (err) {
        // The engine signals unusable readings with TypeError; that is the client's input, not a bug.
        if (err instanceof TypeError) throw new BadRequest(err.message);
        throw err;
      }
    },
  };
}
