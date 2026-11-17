# Urban Air Quality Assistant

**Vertical:** [Challenge 6] Urban Air Quality Assistant

**Live demo:** https://urban-air-assistant-nine.vercel.app

A GenAI-powered assistant that helps families and communities get through severe winter smog. You enter a city and describe your household. The assistant fetches today's live hourly PM2.5 forecast and builds a personal plan with four parts:

1. **A low-exposure daily routine**: the cleanest and dirtiest hours of the day, masks, kids' play and medical precautions.
2. **Indoor air-quality hacks**: sealing, ventilation timing, purifier or a ~Rs 1,500 DIY box-fan filter, kitchen and heating fixes.
3. **Sustainable alternatives**: commute switches, clean cooking and heating, and community actions.
4. **The direct impact of every choice**: % less PM2.5 inhaled, "cigarettes' worth of smoke avoided", per-step savings, and kg of CO2 saved per week.

Google Gemini turns the plan into a warm, plain-language briefing and answers follow-up questions, using only the facts in the plan.

---

## Approach and logic

```
 Browser (vanilla JS, accessible)
   │  POST /api/plan  { city | aqi, profile }
   ▼
 Express API  ── validation · rate limit · CSP/security headers · 16 kB body cap
   │
   ├─► services/airQuality.js   Open-Meteo geocoding + hourly PM2.5 (cached 15 min, 6 s timeout)
   │
   ├─► engine/  (pure, deterministic, fully unit-tested)
   │     aqi.js              CPCB PM2.5 → AQI bands, cleanest/worst time windows
   │     profile.js          whitelists and normalises household + lifestyle input
   │     risk.js             household risk = air band + capped vulnerability uplift
   │     impact.js           inhalation-dose model → % reduction, per-lever savings, CO2
   │     recommendations.js  routine, indoor hacks, sustainable alternatives (each with "why")
   │     plan.js             assembles the plan
   │
   └─► services/llm.js  Gemini: narrates the plan + grounded Q&A
                        (falls back to a rule-based narrator if no key or on error)
```

**Why a hybrid design?** Health advice must be correct and repeatable, so a transparent rules engine produces every number and recommendation. The LLM adds what it is good at: plain-language explanation and conversational follow-up. It can't invent figures, because:

- its system prompt restricts it to the facts in the `PLAN` JSON,
- it only receives a trimmed plan (`planForPrompt`), never the raw request,
- user questions are sanitised and wrapped in `<user_question>` tags, which the model is told to treat as data, not instructions (prompt-injection guard).

### Decision logic (context → advice)

| Context | Effect on the plan |
|---|---|
| AQI band (CPCB: Good → Severe) | Sets the base risk tier and which measures switch on |
| Asthma/COPD/heart, children, elderly, pregnancy, outdoor work | Raises risk by up to 2 tiers (not at all when air is good); adds tailored items such as indoor play, reliever medication and work scheduling |
| Hourly forecast | Picks the cleanest 2-hour daylight window for outdoor time and the dirtiest 3-hour window to avoid |
| Commute mode and distance | Mask advice, commute-switch options with CO2 saved **and** the personal-exposure trade-off; no cycling suggestion on severe days or for long trips |
| Cooking fuel / heating | Kitchen ventilation, clean-cooking and clean-heating switches |
| Owns a purifier? | "Run it in the bedroom" vs "build a DIY box filter" |

### Impact model

For each part of the day, inhaled PM2.5 = outdoor concentration × infiltration ratio × breathing rate × hours. The model compares a "no changes" day with the recommended day, and also scores each step on its own so users can see which choice matters most.

---

## How it works (run locally)

Requires Node.js 20+.

```bash
npm install
npm test          # 44 tests: engine, services (mocked network), HTTP API, security
npm start         # http://localhost:3000
```

Optional GenAI (without a key the app still works fully, using the rules-based narrator):

```bash
export GEMINI_API_KEY=your_key      # never commit it; see .env.example
export GEMINI_MODEL=gemini-2.5-flash
npm start
```

### Deployment

Deployed on Vercel. `public/` is served by the CDN and `api/index.js` wraps the same Express app as one serverless function (see `vercel.json`, which also sets the security headers for static files). Set `GEMINI_API_KEY` in the project's environment variables to enable Gemini. `render.yaml` is included as an alternative for long-running Node hosting.

### API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, genai }` |
| POST | `/api/plan` | `{ city?, aqi?, pm25?, profile }` | `{ plan, narration }` |
| POST | `/api/ask` | same as `/plan` + `{ question, history? }` | `{ answer }` |

`profile = { household: { children, elderly, respiratory, pregnant, outdoorWorker }, lifestyle: { commute, commuteKm, cooking, heating, hasPurifier } }`

---

## Quality, security, efficiency, accessibility

- **Code quality**: small single-purpose modules, a pure engine with dependency injection (`fetchImpl`, `now`, `assistant`) so everything is testable. The only runtime dependency is `express`.
- **Security**: strict CSP (`script-src 'self'`, no inline code), `nosniff`, `frame-ancestors 'none'`, no `X-Powered-By`, per-IP rate limiting, a 16 kB JSON body limit, enum whitelisting and numeric range checks, and DOM built only with `textContent` (no `innerHTML`). The API key is sent in a header, not the URL, and kept in env vars only. The app is stateless and stores no personal data.
- **Efficiency**: no framework, no build step, about 30 kB of front-end code. Upstream responses are cached in a bounded in-memory cache, every network call has a timeout, and static assets are cached for 1 hour.
- **Testing**: `node:test` with no extra test dependencies. Tests cover AQI maths, profile validation, risk tiers, impact model invariants, recommendation rules, network failure paths, LLM fallback and prompt-injection sanitising, the HTTP API (400/404/413/429/502), and security headers. CI runs them on every push.
- **Accessibility**: tested with axe-core (WCAG 2.1 AA, no violations in light or dark mode). The page uses semantic landmarks, a skip link, labelled inputs and fieldsets, 44 px touch targets, visible focus rings, `aria-live` status and chat log, an SVG chart with a title, description and text alternative, and supports `prefers-color-scheme`, `prefers-reduced-motion` and `forced-colors`. It is responsive down to 320 px.

---

## Assumptions

- PM2.5 is used as the driver because it dominates North-Indian winter smog. AQI follows the **Indian CPCB** PM2.5 breakpoints.
- Live data comes from **Open-Meteo Air Quality (CAMS forecast)**. When only an AQI is known, the hourly shape is estimated from a typical winter day (and labelled as estimated in the UI).
- Impact constants are rounded literature values used for illustration, not clinical advice:
  - ~22 µg/m³ PM2.5 over 24 h ≈ 1 cigarette/day (Berkeley Earth rule of thumb)
  - Well-fitted N95/FFP2 lets ~20% through in real-world use
  - Indoor/outdoor ratio: 0.85 typical, 0.55 sealed + DIY filter, 0.35 sealed + HEPA purifier; car cabin 0.6, bus/metro 0.8
  - Breathing rates (m³/h): rest 0.5, walking 1.3, cycling 1.9
  - Tailpipe CO2 per passenger-km: car 0.17, two-wheeler 0.045, bus/metro 0.035; 5 commuting days a week
- The assistant gives general wellbeing guidance and always tells users to contact a doctor if symptoms appear.

## License

MIT
