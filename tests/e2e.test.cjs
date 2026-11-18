'use strict';
// The whole flow against the fake spreadsheet, loading the paste file the way Apps Script does.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBundle } = require('./helpers/fake-spreadsheet.cjs');

function shared(b) {
  return ['SM Seating', 'SM By first name', 'SM By form', 'SM By table', 'SM Faculty', 'SM Check', 'SM Needs you'].map(n => JSON.stringify(b.sheet(n).rows())).join('\n');
}

test('the menu has every item, each pointing at a handler that exists', () => {
  const b = loadBundle();
  b.context.onOpen();
  const menu = b.ui.menus[0];
  assert.equal(menu.name, 'Seated Meals');
  assert.deepEqual(menu.items.map(i => i[0]), ['Sort', 'Sort again with a new shuffle', 'Check again', 'Save this event to history', 'Add a past event to history', 'Make practice data']);
  menu.items.forEach(([, fn]) => { assert.equal(typeof b.context[fn], 'function', fn); assert.ok(!fn.endsWith('_')); });
});

test('practice data, a past event, Sort, Check again after a hand edit, Save, and Sort again with a new shuffle', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  assert.match(b.ui.lastMessage(), /^Made practice data/);
  for (const name of ['Event', 'Rules', 'Tables', 'Not attending', 'Locked seats', 'Seating history', 'Waiter history', 'Students', 'Faculty', 'Faculty list', 'Past event']) assert.ok(b.sheet(name), name);
  assert.equal(b.sheet('Event').rows().find(r => r[0] === 'Season')[1], 'Fall 2026 - 2027');

  b.ui.answers.push({ text: 'Practice dinner B' }, { text: '2026-11-10' });
  b.context.SM_addPastEvent();
  assert.match(b.ui.lastMessage(), /^Matched/);

  const studentsBefore = JSON.stringify(b.sheet('Students').data), facultyBefore = JSON.stringify(b.sheet('Faculty').data);
  b.ui.answers.push({ text: 'Christoph, first practice run' });
  b.context.SM_sort();
  assert.match(b.ui.lastMessage(), /^Seated 325 students and 78 faculty at 46 tables\. 0 rules not fully met\. Read SM Check, then SM Needs you\. When it looks right, share the four shared tabs\./);
  assert.equal(JSON.stringify(b.sheet('Students').data), studentsBefore, 'Sort never writes Students');
  assert.equal(JSON.stringify(b.sheet('Faculty').data), facultyBefore, 'or Faculty');
  assert.ok(b.sheet('SM Seating').isBold(2, 1) && b.sheet('SM Seating').getFrozenRows() === 2);
  assert.ok(b.sheet('SM Check').isBold(1, 1) && b.sheet('SM Check').getFrozenRows() === 1);
  const log = b.sheet('SM Run log').rows();
  assert.deepEqual(log[0], ['Time', 'Who and why', 'Event', 'Date', 'Sort', 'Seed', 'Rules as used', 'Students', 'Faculty', 'Tables', 'Rules not fully met']);
  assert.equal(log[1][1], 'Christoph, first practice run');
  assert.equal(log[1][7], 325);

  // A hand edit: move one student to another table, then Check again.
  const rows = b.sheet('SM Seating').data, i = rows.findIndex((r, k) => k > 1 && r[2] === 'Student' && r[0] === 5);
  rows[i][0] = 6;
  b.context.SM_checkAgain();
  assert.match(b.ui.lastMessage(), /^Checked: 0 failures, \d+ warnings\. Read SM Check\.$/);
  assert.ok(b.sheet('SM By table').rows().some(r => r[0] === rows[i][1]));

  b.context.SM_saveToHistory();
  assert.match(b.ui.lastMessage(), /^Saved 403 seats and 92 waiters to history/);

  const firstSort = shared(b);
  b.ui.answers.push('OK', { text: 'Trying another arrangement' });
  b.context.SM_sortAgain();
  assert.equal(b.sheet('Event').rows().find(r => r[0] === 'Seed')[1], 2, 'Seed went up by one');
  assert.notEqual(shared(b), firstSort);
  assert.equal(b.sheet('SM Run log').rows().length, 3, 'one run log row per Sort');
});

test('Sort asks before replacing SM Seating, and Cancel at either question changes nothing', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  b.ui.answers.push({ text: 'First run' });
  b.context.SM_sort();
  const before = shared(b), log = b.sheet('SM Run log').rows().length;

  b.ui.answers.push('CANCEL');
  b.context.SM_sort();
  assert.match(b.ui.shown[b.ui.shown.length - 2].message, /^This replaces SM Seating and the shared tabs, including changes made by hand\. Rows in Locked seats stay put\. Continue\?$/);
  assert.equal(b.ui.lastMessage(), 'Sort cancelled. Nothing changed.');

  b.ui.answers.push('OK', { button: 'CANCEL' });
  b.context.SM_sort();
  assert.equal(b.ui.lastMessage(), 'Sort cancelled. Nothing changed.');

  b.ui.answers.push('OK', { text: '   ' });
  b.context.SM_sortAgain();
  assert.match(b.ui.lastMessage(), /needs an answer to "Who is running this, and why\?"/);
  assert.equal(b.sheet('Event').rows().find(r => r[0] === 'Seed')[1], 1, 'a cancelled Sort again leaves the Seed alone');
  assert.equal(shared(b), before);
  assert.equal(b.sheet('SM Run log').rows().length, log);
});

test('sorting the practice data twice with the same Seed gives identical SM tabs', () => {
  const one = loadBundle(), two = loadBundle();
  for (const b of [one, two]) {
    b.context.SM_makePracticeData();
    b.ui.answers.push({ text: 'Practice dinner B' }, { text: '2026-11-10' });
    b.context.SM_addPastEvent();
    b.ui.answers.push({ text: 'Same seed' });
    b.context.SM_sort();
  }
  assert.equal(shared(one), shared(two));
});

test('the write helpers refuse every tab they are not for', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  assert.throws(() => b.context.writeTab_('Students', { rows: [['x']] }), /writeTab_ only writes SM tabs/);
  assert.throws(() => b.context.writeTab_('SM Run log', { rows: [['x']] }), /writeTab_ only writes SM tabs other than SM Run log/);
  assert.throws(() => b.context.createTabOnce_('Faculty', [['x']]), /createTabOnce_ only creates setup tabs/);
  assert.throws(() => b.context.appendRows_('SM Seating', [['x']]), /appendRows_ only adds to/);
  assert.throws(() => b.context.rewriteHistory_('Students', [['x']]), /rewriteHistory_ only rewrites/);
  assert.throws(() => b.context.setEventValue_('Sort', 'Together'), /setEventValue_ only sets Seed or Season/);
});

test('Make practice data refuses a spreadsheet that already has students or faculty', () => {
  const b = loadBundle({ Students: [['FirstName', 'LastName', 'Email'], ['Avery', 'Testwood', 'avery.testwood@example.org']] });
  b.context.SM_makePracticeData();
  assert.match(b.ui.lastMessage(), /only runs in a spreadsheet whose Students and Faculty tabs are empty/);
  assert.equal(b.sheet('Students').rows().length, 2, 'nothing was overwritten');
  assert.equal(b.sheet('Faculty'), undefined);
});

test('a problem stops the menu item with a plain message saying what to do', () => {
  const b = loadBundle();
  b.ui.answers.push({ text: 'No data yet' });
  b.context.SM_sort();
  const last = b.ui.shown[b.ui.shown.length - 1];
  assert.equal(last.title, 'Seated Meals stopped');
  assert.match(last.message, /The Students tab is missing or empty\. Download the student file as CSV and import it as a tab named Students\./);
  assert.ok(b.sheet('Event') && b.sheet('Rules') && b.sheet('Tables'), 'the setup tabs were created with their defaults');
  assert.equal(b.sheet('Tables').rows().length, 48);
});
