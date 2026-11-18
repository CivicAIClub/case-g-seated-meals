'use strict';
// History: the last event, waiting this year, the past-event importer and saving an event.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, answer, workbook } = require('./helpers/fixtures.cjs');
const { loadBundle } = require('./helpers/fake-spreadsheet.cjs');
const { SMRead, SMHistory } = core;

const students = [
  student('Avery', 'Testwood', { nick: 'Ace' }),
  student('Blake', 'Samplefield'),
  student('Casey', 'Mockstone'),
  student('Dana', 'Mockstone'),
  student('Drew', 'Mockstone'),
  student('Emery', 'Demoridge'),
  student('Finley', 'Draftton', { nick: 'Fin' })
];
const model = SMRead.readWorkbook(workbook({ students, faculty: [answer('Jordan Protoberry')] }));
function match(rows) {
  const past = rows.map((r, i) => ({ row: i + 2, name: r[0], table: r[1], tableText: String(r[1]), email: r[2] || '', role: r[3] || '' }));
  return SMHistory.matchPastEvent(past, model.students, model.adults);
}

test('the importer matches by email, preferred name, legal name, swapped order and initial', () => {
  const res = match([
    ['Whatever Name', 4, 'blake.samplefield@example.org', 'Waiter'],
    ['Ace Testwood', 5],
    ['Finley  Draftton (Fin)', 6],
    ['Demoridge, Emery', 7],
    ['C. Mockstone', 8],
    ['Jordan Protoberry', 9, '', 'Waiter'],
    ['Samplefield, Blake', 10]
  ]);
  const by = [...res.matched.map(m => m.email)];
  assert.deepEqual(by, ['blake.samplefield@example.org', 'avery.testwood@example.org', 'finley.draftton@example.org', 'emery.demoridge@example.org',
    'casey.mockstone@example.org', 'jordan.protoberry@example.org']);
  assert.equal(res.needs.length, 1, 'only the repeated person needs a look');
  assert.match(res.needs[0].problem, /row 8: Same person as Past event row 2 \(Blake Samplefield\)/);
  assert.equal(res.matched[0].role, 'Waiter');
  assert.equal(res.matched[5].kind, 'Faculty');
  assert.equal(res.matched[5].role, '', 'faculty never get a waiter role');
});

test('the importer refuses a name that matches two students', () => {
  const res = match([['D. Mockstone', 3]]);
  assert.equal(res.matched.length, 0);
  assert.match(res.needs[0].problem, /Matches more than one person: Dana Mockstone \(dana\.mockstone@example\.org\); Drew Mockstone/);
});

test('an unmatched row lists the closest candidates, and nothing is added for it', () => {
  const res = match([['Casey Mokstone', 3], ['Nobody Here', 4], ['Blake Samplefield', 'x']]);
  assert.equal(res.matched.length, 0);
  assert.match(res.needs[0].problem, /Matches nobody in Students or the faculty\. Closest: Casey Mockstone/);
  assert.match(res.needs[0].problem, /If they're still at the school, type their email into this row and run Add a past event to history again\. If they graduated or left, ignore this row\.$/);
  assert.match(res.needs[1].problem, /Matches nobody/);
  assert.match(res.needs[2].problem, /Type the right email into this row/, 'a bad table number is not a graduate');
  assert.equal(res.unmatched, 2);
  assert.equal(res.problems, 1);
  assert.match(res.needs[2].problem, /Table "x" is not a table number/);
});

test('the last event is the latest date before this one, and waiting counts from August 1', () => {
  const seats = [
    { event: 'A', date: '2026-09-22', id: 'x@example.org', table: 3 }, { event: 'B', date: '2026-11-10', id: 'x@example.org', table: 7 },
    { event: 'Later', date: '2026-12-20', id: 'x@example.org', table: 9 }
  ];
  const last = SMHistory.lastEvent(seats, '2026-12-15');
  assert.equal(last.event, 'B');
  assert.equal(last.tableById['x@example.org'], 7);
  assert.equal(SMHistory.lastEvent([], '2026-12-15'), null);
  const w = SMHistory.waiterSummary([
    { date: '2026-05-01', id: 'x@example.org', role: 'Waiter' }, { date: '2026-09-22', id: 'x@example.org', role: 'Assistant' },
    { date: '2026-11-10', id: 'y@example.org', role: 'Waiter' }, { date: '2026-11-10', id: 'z@example.org', role: '' }
  ], '2026-12-15');
  assert.equal(w.countById['x@example.org'], 1);
  assert.equal(w.ever['x@example.org'], true);
  assert.deepEqual(Object.keys(w.lastIds), ['y@example.org']);
  assert.equal(SMHistory.schoolYearStart('2027-03-01'), '2026-08-01');
});

function sortedBook() {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  b.ui.answers.push({ text: 'Practice run' });
  b.context.SM_sort();
  return b;
}

test('Save this event to history appends seats and waiters, and asks before replacing them', () => {
  const b = sortedBook(), seatsBefore = b.sheet('Seating history').getLastRow(), waitsBefore = b.sheet('Waiter history').getLastRow();
  b.context.SM_saveToHistory();
  assert.match(b.ui.lastMessage(), /^Saved \d+ seats and 92 waiters to history\. The next Sort will use them\.$/);
  const added = b.sheet('Seating history').getLastRow() - seatsBefore;
  assert.ok(added > 390);
  assert.equal(b.sheet('Waiter history').getLastRow() - waitsBefore, 92);

  b.ui.answers.push('NO');
  b.context.SM_saveToHistory();
  assert.match(b.ui.shown[b.ui.shown.length - 2].message, /History already has Candlelight on 2026-12-15\. Replace those rows/);
  assert.match(b.ui.lastMessage(), /^Nothing saved/);
  assert.equal(b.sheet('Seating history').getLastRow() - seatsBefore, added);

  b.ui.answers.push('YES');
  b.context.SM_saveToHistory();
  assert.equal(b.sheet('Seating history').getLastRow() - seatsBefore, added, 'replaced, not added twice');
  assert.equal(b.sheet('Waiter history').getLastRow() - waitsBefore, 92);
});

test('Add a past event to history matches the pasted list, lists the rest, and asks before replacing', () => {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  const before = b.sheet('Seating history').getLastRow();
  b.ui.answers.push({ text: 'Practice dinner B' }, { text: '2026-11-10' });
  b.context.SM_addPastEvent();
  assert.match(b.ui.lastMessage(), /^Matched \d+ of \d+ rows and added them to history as Practice dinner B on 2026-11-10\. 2 rows matched nobody \(listed in SM Needs you\)\. That is expected for people who graduated or left\./);
  const needs = b.sheet('SM Needs you').rows().map(r => r.join(' | ')).join('\n');
  assert.match(needs, /Quinn Nobodyhere/);
  assert.match(needs, /Matches nobody in Students or the faculty\. Closest:/);
  const added = b.sheet('Seating history').getLastRow() - before;
  assert.ok(added > 400);
  b.ui.answers.push({ text: 'Practice dinner B' }, { text: '11/10/2026' }, 'YES');
  b.context.SM_addPastEvent();
  assert.equal(b.sheet('Seating history').getLastRow() - before, added, 'run again, it replaced the earlier rows');
  b.ui.answers.push({ text: 'Practice dinner B' }, { text: 'last week' });
  b.context.SM_addPastEvent();
  assert.match(b.ui.lastMessage(), /"last week" is not a date/);
});
