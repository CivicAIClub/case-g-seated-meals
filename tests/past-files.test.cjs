'use strict';
// Add a past event to history on the layouts of Mr. Gibbs's real past seating files (layouts only;
// every name here is invented): separate last and first name columns with W and AW roles; a Grad
// Year tab with faculty rows in it; and a table and role in one cell.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, answer, workbook } = require('./helpers/fixtures.cjs');
const { loadBundle } = require('./helpers/fake-spreadsheet.cjs');
const { SMRead, SMHistory, SMOutput } = core;

const students = [student('Avery', 'Testwood', { nick: 'Ace' }), student('Blake', 'Samplefield'), student('Casey', 'Mockstone')];
const model = SMRead.readWorkbook(workbook({ students, faculty: [answer('Jordan Protoberry')] }));
function importTab(values) {
  const past = SMRead.readPastEvent(values, model.event);
  return { past, res: SMHistory.matchPastEvent(past, model.students, model.adults) };
}
function plain(list) { return JSON.parse(JSON.stringify(list)); }

test('roles: W is the waiter, and AW, A, Asst and Asst. Waiter are the assistant', () => {
  const cases = { 'W': 'Waiter', 'Waiter': 'Waiter', 'Yes': 'Waiter', 'X': 'Waiter', 'Head waiter': 'Waiter',
    'AW': 'Assistant', 'A': 'Assistant', 'Asst': 'Assistant', 'Asst. Waiter': 'Assistant', 'Assistant': 'Assistant', 'Assistant Waiter': 'Assistant', '': '', 'Guest': '' };
  for (const [typed, role] of Object.entries(cases)) assert.equal(SMRead.roleOf(typed), role, typed);
});

test('last and first name columns are joined, and W and AW are read', () => {
  const { past, res } = importTab([
    ['Last Name', 'First Name', 'Grad Year', 'Table', 'Role'],
    ['Testwood', 'Avery', 2027, 12, 'AW'],
    ['Samplefield', 'Blake', 2028, 12, 'W'],
    ['Mockstone', 'Casey', 2029, 3, '']
  ]);
  assert.deepEqual(plain(past.map(r => [r.name, r.table, r.role])), [['Avery Testwood', 12, 'Assistant'], ['Blake Samplefield', 12, 'Waiter'], ['Casey Mockstone', 3, '']]);
  assert.equal(res.matched.length, 3);
  assert.deepEqual(plain(res.matched.map(m => m.role)), ['Assistant', 'Waiter', '']);
});

test('a tab with a Name column and faculty rows in it uses the full name', () => {
  const { res } = importTab([
    ['Grad Year', 'First', 'Table', 'Name'],
    [2027, 'Ace', 4, 'Ace Testwood'],
    ['Faculty', 'Jordan', 4, 'Jordan Protoberry']
  ]);
  assert.deepEqual(plain(res.matched.map(m => [m.kind, m.email, m.table])), [['Student', 'avery.testwood@example.org', 4], ['Faculty', 'jordan.protoberry@example.org', 4]]);
});

test('a table and a role in one cell, and a class year after the name', () => {
  const { past, res } = importTab([
    ['Name', 'Table'],
    ["Testwood, Avery '27", '12 W'],
    ['Blake Samplefield', 'Table 7'],
    ['Casey Mockstone', '9 AW']
  ]);
  assert.deepEqual(plain(past.map(r => [r.table, r.role])), [[12, 'Waiter'], [7, ''], [9, 'Assistant']]);
  assert.equal(res.matched.length, 3);
});

test('without a Name column or first and last name columns, it stops and names the headers', () => {
  assert.throws(() => SMRead.readPastEvent([['Student', 'Table'], ['Avery Testwood', 3]], model.event), /The Past event tab has no column for "Name".*"Student", "Table"/);
});

test('someone who graduated is expected, and the finish message counts them on their own', () => {
  const { past, res } = importTab([['Name', 'Table'], ['Avery Testwood', 2], ['Gone Graduated', 3], ['Blake Samplefield', 'x']]);
  assert.equal(res.unmatched, 1);
  assert.equal(res.problems, 1);
  assert.match(res.needs[0].problem, /^Past event row 3: Matches nobody in Students or the faculty\..* If they graduated or left, ignore this row\.$/);
  assert.equal(SMOutput.pastEventMessage(res, past.length, 'Candlelight 2025', '2025-12-16'),
    'Matched 1 of 3 rows and added them to history as Candlelight 2025 on 2025-12-16. 1 row matched nobody (listed in SM Needs you). ' +
    'That is expected for people who graduated or left. For anyone still at the school, type their email into their Past event row and run this again (it asks before replacing). ' +
    '1 row needs a person: see SM Needs you. Type the right email into those Past event rows and run this again (it asks before replacing).');
});

test('in the spreadsheet, AW from a past file lands in Waiter history as Assistant', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  const tab = b.sheet('Past event');
  // Replace the practice Past event with a file shaped like Candlelight 2025: last, first, year, table, role.
  const students = b.sheet('Students').rows().slice(1).filter(r => r[3]).slice(0, 3);
  tab.clearContents();
  tab.getRange(1, 1, 4, 5).setValues([['Last Name', 'First Name', 'Grad Year', 'Table', 'Role']].concat(students.map((s, i) => [s[2], s[0], s[4], 5, ['W', 'AW', ''][i]])));
  b.ui.answers.push({ text: 'Old dinner' }, { text: '2025-12-16' });
  b.context.SM_addPastEvent();
  assert.match(b.ui.lastMessage(), /^Matched 3 of 3 rows and added them to history as Old dinner on 2025-12-16\. Every row matched\.$/);
  const waits = b.sheet('Waiter history').rows().filter(r => r[0] === 'Old dinner').map(r => r[4]);
  assert.deepEqual(waits, ['Waiter', 'Assistant']);
});
