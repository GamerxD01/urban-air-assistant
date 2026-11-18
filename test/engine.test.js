import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pm25ToAqi,
  aqiToPm25,
  bandForPm25,
  normalizeAirQuality,
  findWindow,
  synthesizeHourly,
} from '../src/engine/aqi.js';
import { normalizeProfile } from '../src/engine/profile.js';
import { assessRisk } from '../src/engine/risk.js';
import { computeImpact, commuteSwitchImpact } from '../src/engine/impact.js';
import { buildPlan } from '../src/engine/plan.js';

const baseHousehold = { children: false, elderly: false, respiratory: false, pregnant: false, outdoorWorker: false };

test('pm25ToAqi hits CPCB breakpoints', () => {
  assert.equal(pm25ToAqi(0), 0);
  assert.equal(pm25ToAqi(30), 50);
  assert.equal(pm25ToAqi(60), 100);
  assert.equal(pm25ToAqi(90), 200);
  assert.equal(pm25ToAqi(120), 300);
  assert.equal(pm25ToAqi(250), 400);
  assert.equal(pm25ToAqi(380), 500);
  assert.equal(pm25ToAqi(9999), 500, 'clamps above the scale');
  assert.equal(pm25ToAqi(-5), 0, 'clamps below zero');
});

test('aqiToPm25 inverts pm25ToAqi within rounding', () => {
  for (const pm of [10, 45, 75, 100, 180, 300]) {
    assert.ok(Math.abs(aqiToPm25(pm25ToAqi(pm)) - pm) < 2, `round trip for ${pm}`);
  }
});

test('bandForPm25 picks the right band', () => {
  assert.equal(bandForPm25(10).id, 'good');
  assert.equal(bandForPm25(100).id, 'poor');
  assert.equal(bandForPm25(300).id, 'severe');
});

test('synthesised hourly series keeps the requested daily mean', () => {
  const mean = synthesizeHourly(200).reduce((a, b) => a + b, 0) / 24;
  assert.ok(Math.abs(mean - 200) < 1);
});

test('findWindow finds the minimum and maximum windows', () => {
  const hourly = Array.from({ length: 24 }, (_, i) => (i === 13 || i === 14 ? 10 : 100));
  assert.deepEqual(findWindow(hourly, { from: 7, to: 19, length: 2, mode: 'min' }), { start: 13, end: 15, avg: 10 });
  assert.equal(findWindow(hourly, { length: 2, mode: 'max' }).avg, 100);
});

test('normalizeAirQuality accepts hourly, pm25 or aqi and rejects nothing', () => {
  const a = normalizeAirQuality({ hourly: Array(24).fill(80) });
  assert.equal(a.pm25, 80);
  assert.equal(a.hourlyIsEstimated, false);
  const b = normalizeAirQuality({ pm25: 150 });
  assert.equal(b.hourlyIsEstimated, true);
  const c = normalizeAirQuality({ aqi: 300 });
  assert.equal(c.band.id, 'poor');
  assert.throws(() => normalizeAirQuality({}), TypeError);
  assert.throws(() => normalizeAirQuality({ hourly: [1, 2, 3] }), TypeError, 'short hourly series is unusable');
});

test('normalizeProfile whitelists values and reports errors', () => {
  const ok = normalizeProfile({ household: { children: 'true' }, lifestyle: { commute: 'car', commuteKm: '12' } });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.household.children, true);
  assert.equal(ok.value.lifestyle.commuteKm, 12);

  const bad = normalizeProfile({ lifestyle: { commute: 'rocket', commuteKm: 9999, cooking: '<script>' } });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
  assert.equal(bad.value.lifestyle.commute, 'two_wheeler', 'falls back to a safe default');

  assert.equal(normalizeProfile(null).ok, true);
  assert.equal(normalizeProfile('nonsense').ok, true);
  assert.equal(
    normalizeProfile({ lifestyle: { commute: 'work_from_home', commuteKm: 20 } }).value.lifestyle.commuteKm,
    0,
  );
});

test('risk rises with vulnerability but never when the air is clean', () => {
  assert.equal(assessRisk(0, { ...baseHousehold, respiratory: true, children: true }).tier, 0);
  assert.equal(assessRisk(2, baseHousehold).tier, 2);
  assert.equal(assessRisk(2, { ...baseHousehold, children: true }).tier, 3);
  assert.equal(
    assessRisk(3, { ...baseHousehold, respiratory: true, children: true, elderly: true }).tier,
    5,
    'uplift capped at two tiers',
  );
  assert.equal(assessRisk(5, { ...baseHousehold, respiratory: true }).tier, 5, 'never exceeds the top tier');
});

const lifestyle = {
  commute: 'two_wheeler',
  commuteKm: 10,
  cooking: 'lpg',
  heating: 'none',
  homeType: 'apartment',
  hasPurifier: false,
};

function impactFor(aqi, household = baseHousehold, ls = lifestyle) {
  const airQuality = normalizeAirQuality({ aqi });
  const risk = assessRisk(airQuality.band.index, household);
  return computeImpact({ airQuality, lifestyle: ls, risk });
}

test('impact: clean air needs no changes', () => {
  const impact = impactFor(40);
  assert.equal(impact.reductionPct, 0);
  assert.equal(impact.levers.length, 0);
});

test('impact: severe air gives a large, positive, internally consistent reduction', () => {
  const impact = impactFor(380, { ...baseHousehold, children: true });
  assert.ok(impact.reductionPct > 20 && impact.reductionPct < 90, `got ${impact.reductionPct}`);
  assert.ok(impact.recommended.dose < impact.baseline.dose);
  assert.ok(impact.cigarettesPerDayAvoided > 0);
  const sorted = [...impact.levers].sort((a, b) => b.savedUg - a.savedUg);
  assert.deepEqual(impact.levers, sorted, 'levers are ranked by benefit');
});

test('impact: owning a purifier makes the indoor lever stronger', () => {
  const diy = impactFor(350).levers.find((l) => l.id === 'indoorUpgrade');
  const hepa = impactFor(350, baseHousehold, { ...lifestyle, hasPurifier: true }).levers.find(
    (l) => l.id === 'indoorUpgrade',
  );
  assert.ok(hepa.savedUg > diy.savedUg);
});

test('impact: working from home removes commute exposure', () => {
  const wfh = impactFor(350, baseHousehold, { ...lifestyle, commute: 'work_from_home', commuteKm: 0 });
  const bike = impactFor(350);
  assert.ok(wfh.baseline.dose < bike.baseline.dose);
});

test('commuteSwitchImpact reports CO2 saved and personal exposure change', () => {
  const airQuality = normalizeAirQuality({ aqi: 300 });
  const r = commuteSwitchImpact(
    { airQuality, lifestyle: { ...lifestyle, commute: 'car' }, riskTier: 4 },
    'public_transport',
  );
  assert.ok(r.co2SavedKgPerWeek > 0);
  assert.equal(typeof r.personalInhalationChangePct, 'number');
});

test('buildPlan: severe plan for a vulnerable household is complete and actionable', () => {
  const plan = buildPlan({
    airQuality: { aqi: 380, location: { name: 'Lucknow' } },
    profile: {
      household: { children: true, respiratory: true },
      lifestyle: { commute: 'car', commuteKm: 12, cooking: 'biomass', heating: 'wood_coal' },
    },
  });
  assert.equal(plan.risk.id, 'severe');
  const ids = (xs) => xs.map((x) => x.id);
  assert.ok(ids(plan.routine).includes('mask'));
  assert.ok(ids(plan.routine).includes('medical'));
  assert.ok(ids(plan.routine).includes('kids-play'));
  assert.ok(ids(plan.indoor).includes('diy-filter'));
  assert.ok(ids(plan.indoor).includes('heating'));
  assert.ok(ids(plan.sustainable).includes('clean-cooking'));
  assert.ok(plan.sustainable.some((s) => s.id.startsWith('switch-')));
  for (const item of [...plan.routine, ...plan.indoor, ...plan.sustainable]) {
    assert.ok(item.title && item.why, `${item.id} explains why it matters`);
  }
  assert.match(plan.summary, /Lucknow/);
  assert.match(plan.disclaimer, /not medical advice/);
});

test('buildPlan: clean air yields a calm, minimal plan', () => {
  const plan = buildPlan({ airQuality: { pm25: 15 }, profile: {} });
  assert.equal(plan.risk.tier, 0);
  assert.deepEqual(
    plan.routine.map((r) => r.id),
    ['normal-day'],
  );
  assert.equal(plan.indoor[0].id, 'ventilate');
  assert.match(plan.summary, /No extra precautions/);
});

test('buildPlan: purifier owners are told to use it, not to build one', () => {
  const plan = buildPlan({ airQuality: { aqi: 300 }, profile: { lifestyle: { hasPurifier: true } } });
  const ids = plan.indoor.map((x) => x.id);
  assert.ok(ids.includes('purifier'));
  assert.ok(!ids.includes('diy-filter'));
});

test('buildPlan: does not suggest cycling when the air is severe', () => {
  const plan = buildPlan({
    airQuality: { aqi: 450 },
    profile: { lifestyle: { commute: 'two_wheeler', commuteKm: 3 } },
  });
  assert.ok(!plan.sustainable.some((s) => s.id === 'switch-cycle'));
});

test('buildPlan: invalid profile values are reported, not trusted', () => {
  const plan = buildPlan({ airQuality: { aqi: 200 }, profile: { lifestyle: { commute: 'teleport' } } });
  assert.ok(plan.profileWarnings.length > 0);
  assert.equal(plan.profile.lifestyle.commute, 'two_wheeler');
});

test('buildPlan: car owners get a carpool option that halves emissions without changing exposure', () => {
  const plan = buildPlan({ airQuality: { aqi: 300 }, profile: { lifestyle: { commute: 'car', commuteKm: 10 } } });
  const carpool = plan.sustainable.find((s) => s.id === 'switch-carpool');
  assert.ok(carpool);
  assert.equal(carpool.impact.personalInhalationChangePct, 0);
  assert.equal(carpool.impact.co2SavedKgPerWeek, 8.5);
  assert.match(carpool.detail, /stays the same/);
});

test('buildPlan: pregnancy, elderly and outdoor work add their own protections', () => {
  const plan = buildPlan({
    airQuality: { aqi: 320 },
    profile: { household: { pregnant: true, elderly: true, outdoorWorker: true } },
  });
  const ids = plan.routine.map((r) => r.id);
  assert.ok(ids.includes('vulnerable'));
  assert.ok(ids.includes('outdoor-work'));
  assert.ok(ids.includes('schedule-flex'));
  for (const item of plan.routine) assert.ok(item.when, `${item.id} says when to do it`);
});

test('buildPlan: outdoor workers get no work-scheduling item when air is only moderate', () => {
  const plan = buildPlan({ airQuality: { aqi: 150 }, profile: { household: { outdoorWorker: true } } });
  assert.ok(!plan.routine.some((r) => r.id === 'outdoor-work'));
});
