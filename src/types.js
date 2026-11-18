/**
 * Shared JSDoc types for the decision engine and the HTTP API.
 * Type-only module: it exports nothing at runtime.
 * @module types
 */

/**
 * @typedef {object} TimeWindow A run of consecutive hours and its average PM2.5.
 * @property {number} start first hour, 0-23
 * @property {number} end hour after the last one, 1-24
 * @property {number} avg mean PM2.5 over the window, µg/m³
 */

/**
 * @typedef {object} Band CPCB AQI band.
 * @property {string} id
 * @property {string} label
 * @property {number} index 0 (good) to 5 (severe)
 */

/**
 * @typedef {object} Location
 * @property {string} name
 * @property {number} [latitude]
 * @property {number} [longitude]
 */

/**
 * @typedef {object} AirQualityInput What a caller knows about today's air; at least one reading is required.
 * @property {number} [pm25]
 * @property {number} [aqi]
 * @property {number[]} [hourly] 24 hourly PM2.5 values
 * @property {string} [source]
 * @property {Location | null} [location]
 * @property {string | null} [asOf]
 */

/**
 * @typedef {object} AirQuality Normalised air quality used by the whole engine.
 * @property {number} pm25 daily mean PM2.5, µg/m³
 * @property {number} aqi
 * @property {Band} band
 * @property {number[]} hourly
 * @property {boolean} hourlyIsEstimated
 * @property {TimeWindow} bestWindow
 * @property {TimeWindow} worstWindow
 * @property {string} source
 * @property {Location | null} location
 * @property {string | null} asOf
 */

/**
 * @typedef {object} Household
 * @property {boolean} children
 * @property {boolean} elderly
 * @property {boolean} respiratory
 * @property {boolean} pregnant
 * @property {boolean} outdoorWorker
 */

/** @typedef {'walk' | 'cycle' | 'two_wheeler' | 'car' | 'carpool' | 'public_transport' | 'work_from_home'} CommuteMode */

/**
 * @typedef {object} Lifestyle
 * @property {CommuteMode} commute
 * @property {number} commuteKm one way
 * @property {string} cooking
 * @property {string} heating
 * @property {string} homeType
 * @property {boolean} hasPurifier
 */

/** @typedef {{ household: Household, lifestyle: Lifestyle }} Profile */

/**
 * @typedef {object} Risk
 * @property {number} tier 0 (minimal) to 5 (severe)
 * @property {string} id
 * @property {string} label
 * @property {number} uplift tiers added for vulnerable household members
 * @property {string[]} sensitiveGroups
 * @property {string[]} reasons
 */

/**
 * @typedef {object} DayExposure
 * @property {number} dose µg of PM2.5 inhaled over the day
 * @property {number} effectivePm25 breathing-weighted concentration, µg/m³
 * @property {number} cigarettes equivalent cigarettes per day
 */

/**
 * @typedef {object} Lever One recommended change and what it saves on its own.
 * @property {string} id
 * @property {string} label
 * @property {number} savedUg
 * @property {number} savedPct
 */

/**
 * @typedef {object} Impact
 * @property {DayExposure} baseline
 * @property {DayExposure} recommended
 * @property {number} reductionPct
 * @property {number} cigarettesPerDayAvoided
 * @property {Lever[]} levers
 * @property {number} outdoorHoursRecommended
 * @property {object} assumptions
 */

/**
 * @typedef {object} CommuteSwitch
 * @property {number} co2SavedKgPerWeek
 * @property {number} personalInhalationChangePct
 * @property {number} personalInhalationChangeMaskedPct
 */

/**
 * @typedef {object} Item One piece of advice. `why` always explains the direct effect of the choice.
 * @property {string} id
 * @property {string} title
 * @property {string} [detail]
 * @property {string} why
 * @property {'outdoors' | 'protection' | 'indoor' | 'community'} tag
 * @property {string} [when]
 * @property {CommuteSwitch} [impact]
 */

/**
 * @typedef {object} PlanContext Everything the recommendation rules may look at.
 * @property {AirQuality} airQuality
 * @property {Risk} risk
 * @property {Profile} profile
 * @property {Impact} impact
 */

/**
 * @typedef {object} Plan
 * @property {string} generatedFor ISO date
 * @property {AirQuality} airQuality
 * @property {Risk} risk
 * @property {string} headline
 * @property {string} summary
 * @property {Item[]} routine
 * @property {Item[]} indoor
 * @property {Item[]} sustainable
 * @property {Impact} impact
 * @property {Profile} profile
 * @property {string[]} profileWarnings
 * @property {string} disclaimer
 */

/** @typedef {{ text: string, engine: 'gemini' | 'rules' }} Narration */

/** @typedef {{ role: 'user' | 'assistant', text: string }} ChatTurn */

export {};
