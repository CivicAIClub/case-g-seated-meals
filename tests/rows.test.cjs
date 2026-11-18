'use strict';
// Real Google Sheets tabs have 1,000 rows and 26 columns when new, and a write past them stops
// with an error. Seating history passes 1,000 rows after about three dinners, so every write
// helper adds rows first. The fake spreadsheet has the same limits, so these tests would catch it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Sheet, loadBundle } = require('./helpers/fake-spreadsheet.cjs');

test('the fake spreadsheet has the limits of a real tab', () => {
  const s = new Sheet('Example');
  assert.equal(s.getMaxRows(), 1000);
  assert.equal(s.getMaxColumns(), 26);
  assert.throws(() => s.getRange(1000, 1, 2, 1), /The coordinates of the range are outside the dimensions of the sheet/);
  assert.throws(() => s.getRange(1, 26, 1, 2), /outside the dimensions/);
  s.insertRowsAfter(1000, 5);
  s.getRange(1001, 1, 5, 1).setValues([[1], [2], [3], [4], [5]]);
  assert.equal(s.getLastRow(), 1005);
});

test('Save this event to history works past 1,000 rows, and keeps every row', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  b.ui.answers.push({ text: 'Practice dinner B' }, { text: '2026-11-10' });
  b.context.SM_addPastEvent();
  b.ui.answers.push({ text: 'Rows test' });
  b.context.SM_sort();
  const event = b.sheet('Event').data, nameRow = event.findIndex(r => r[0] === 'Event name');
  const start = b.sheet('Seating history').getLastRow();
  let saved = 0;
  for (const name of ['Dinner one', 'Dinner two', 'Dinner three']) {
    event[nameRow][1] = name;
    b.context.SM_saveToHistory();
    const m = b.ui.lastMessage().match(/^Saved (\d+) seats/);
    assert.ok(m, b.ui.lastMessage());
    saved += Number(m[1]);
  }
  const history = b.sheet('Seating history');
  assert.ok(history.getLastRow() > 1000, 'past the first 1,000 rows');
  assert.equal(history.getLastRow(), start + saved, 'every saved row is there');
  for (const name of ['Dinner one', 'Dinner two', 'Dinner three']) assert.ok(history.rows().some(r => r[0] === name), name);
  assert.ok(history.getMaxRows() >= history.getLastRow());
});
