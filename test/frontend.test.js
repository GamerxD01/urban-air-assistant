import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandOf,
  hourLabel,
  timeSpan,
  lerp,
  mixColor,
  toPlanRequest,
  validatePlanRequest,
  BAND_VARS,
} from '../public/js/format.js';

test('bandOf follows the CPCB PM2.5 edges', () => {
  assert.deepEqual([0, 30, 31, 60, 90, 120, 121, 250, 251, 999].map(bandOf), [0, 0, 1, 1, 2, 3, 4, 4, 5, 5]);
  assert.equal(BAND_VARS.length, 6);
});

test('hourLabel and timeSpan format 12-hour times, wrapping midnight', () => {
  assert.deepEqual([0, 1, 11, 12, 13, 23, 24].map(hourLabel), ['12am', '1am', '11am', '12pm', '1pm', '11pm', '12am']);
  assert.equal(timeSpan({ start: 13, end: 15 }), 'from 1pm to 3pm');
  assert.equal(timeSpan({ start: 21, end: 24 }), 'from 9pm to 12am');
});

test('lerp and mixColor blend linearly', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(mixColor('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(mixColor('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(mixColor('#000000', '#ff0000', 0.5), 'rgb(128,0,0)');
});

test('toPlanRequest maps form fields to the API shape', () => {
  const fields = {
    city: '  Delhi ',
    aqi: '',
    children: 'on',
    respiratory: 'on',
    commute: 'car',
    commuteKm: '12',
    cooking: 'lpg',
    heating: 'none',
    hasPurifier: null,
  };
  const req = toPlanRequest((name) => fields[name] ?? null);
  assert.equal(req.city, 'Delhi');
  assert.equal(req.aqi, undefined);
  assert.deepEqual(req.profile.household, {
    children: true,
    elderly: false,
    respiratory: true,
    pregnant: false,
    outdoorWorker: false,
  });
  assert.equal(req.profile.lifestyle.commute, 'car');
  assert.equal(req.profile.lifestyle.hasPurifier, false);

  const manual = toPlanRequest((name) => (name === 'aqi' ? '320' : null));
  assert.equal(manual.aqi, 320);
  assert.equal(manual.city, undefined);
});

test('validatePlanRequest mirrors the server rules', () => {
  assert.equal(validatePlanRequest({ city: 'Delhi' }), null);
  assert.equal(validatePlanRequest({ aqi: 0 }), null);
  assert.equal(validatePlanRequest({}).field, 'city');
  assert.equal(validatePlanRequest({ aqi: 501 }).field, 'aqi');
  assert.equal(validatePlanRequest({ aqi: Number.NaN }).field, 'aqi');
});
