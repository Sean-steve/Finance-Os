import {test} from 'node:test';
import assert from 'node:assert/strict';
import {occurrenceDates} from '../src/b3.js';

test('B3 month-end recurrence uses original anchor without drifting',()=>{
 assert.deepEqual(occurrenceDates('2026-01-31','MONTHLY','2026-01-01','2026-05-31'),
  ['2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31']);
 assert.deepEqual(occurrenceDates('2024-01-31','MONTHLY','2024-01-01','2024-03-31'),
  ['2024-01-31','2024-02-29','2024-03-31']);
 assert.deepEqual(occurrenceDates('2024-02-29','YEARLY','2024-01-01','2028-03-31'),
  ['2024-02-29','2025-02-28','2026-02-28','2027-02-28','2028-02-29']);
});
test('B3 source estimate is not a recurring payment for variable cadence',()=>{
 assert.deepEqual(occurrenceDates('2026-10-31','VARIABLE','2026-10-31','2027-03-31'),['2026-10-31']);
 assert.deepEqual(occurrenceDates('2026-10-31','VARIABLE','2026-11-01','2027-03-31'),[]);
 assert.deepEqual(occurrenceDates('2026-10-31','ONCE','2026-10-31','2027-03-31'),['2026-10-31']);
});
test('B3 recurrence respects past schedule, end date and exact 7-day pattern',()=>{
 assert.deepEqual(occurrenceDates('2026-10-01','WEEKLY','2026-10-13','2026-11-05','2026-10-23'),['2026-10-15','2026-10-22']);
 assert.deepEqual(occurrenceDates('2026-01-31','QUARTERLY','2026-04-01','2026-12-31'),
  ['2026-04-30','2026-07-31','2026-10-31']);
 assert.deepEqual(occurrenceDates('2010-04-30','MONTHLY','2026-10-01','2026-12-01'),
  ['2026-10-30','2026-11-30']);
 assert.deepEqual(occurrenceDates('2027-01-01','MONTHLY','2026-01-01','2026-12-31'),[]);
 assert.deepEqual(occurrenceDates('2026-01-01','MONTHLY','2026-10-01','2026-12-01','2026-09-30'),[]);
});
