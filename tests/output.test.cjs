'use strict';
// The SM tabs: the four shared tabs show only their listed columns, SM By table blocks and guest
// lines, formulas are never written, and Check again catches hand edits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, practiceTabs } = require('./helpers/fixtures.cjs');
const { loadBundle } = require('./helpers/fake-spreadsheet.cjs');
const { SMRead, SMSeat, SMOutput } = core;

const { tabs, data } = practiceTabs({ withPast: true });
const model = SMRead.readWorkbook(tabs);
const result = SMSeat.sort(model);
const out = SMOutput.allTabs(model, result, true);

test('the four shared tabs have only their listed columns', () => {
  const expected = {
    'SM By first name': ['First', 'Last', 'Form', 'Table', 'Role'],
    'SM By form': ['Form', 'Last', 'First', 'Table', 'Role'],
    'SM By table': ['Name', 'Form', 'Role'],
    'SM Faculty': ['Name', 'Table', 'Guests']
  };
  for (const [name, headers] of Object.entries(expected)) {
    assert.deepEqual([...out[name].rows[0]], headers, name);
    assert.ok(out[name].rows.every(r => r.length <= headers.length), name + ' has no extra columns');
  }
});

test('nothing private leaks into the shared tabs', () => {
  const advisories = new Set(model.students.map(s => s.advisory)), teams = new Set(model.students.map(s => s.sport));
  for (const name of Object.keys(SMOutput.SHARED_HEADERS)) {
    for (const row of out[name].rows) for (const cell of row) {
      const v = String(cell);
      assert.ok(!/@/.test(v), name + ': email ' + v);
      assert.ok(!/^(Female|Male|Nonbinary|B|D|Boarding|Day)$/.test(v), name + ': ' + v);
      assert.ok(!advisories.has(v) && !teams.has(v), name + ': ' + v);
      assert.ok(!/Dealt by form|Swapped to meet|Locked:|Household with/.test(v), name + ': rule detail ' + v);
    }
  }
});

test('SM By table has a bold block per table with adults, guest lines, then students', () => {
  const t = out['SM By table'], rows = t.rows;
  const starts = rows.map((r, i) => [r[0], i + 1]).filter(([v]) => /^Table \d+$/.test(v));
  assert.equal(starts.length, 46);
  assert.deepEqual(starts.map(([, n]) => n), t.bold.slice(1), 'each table number is bold');
  const host = model.adults.find(a => a.email === data.planted.guestHosts[1]);
  const guestLines = rows.filter(r => /\(guest of /.test(r[0])).map(r => r[0]);
  assert.ok(guestLines.includes('Pat Guestwell (guest of ' + host.name + ')'));
  const block = rows.slice(starts[0][1], (starts[1][1]) - 2);
  const firstStudent = block.findIndex(r => r[1] !== '');
  assert.ok(firstStudent > 0, 'adults come first');
  assert.ok(block.slice(firstStudent).every(r => r[1] !== ''), 'then students, each with a form');
  assert.deepEqual([...rows[starts[1][1] - 2]], ['', '', ''], 'a blank row between tables');
});

test('SM Faculty lists guests, SM By form has a bold row per form, SM Seating starts with the note', () => {
  const host = model.adults.find(a => a.email === data.planted.guestHosts[1]);
  assert.equal(out['SM Faculty'].rows.find(r => r[0] === host.name)[2], 'Pat Guestwell, Lee Guestwell');
  const forms = out['SM By form'];
  assert.deepEqual([...forms.bold.slice(1).map(n => forms.rows[n - 1][0])], ['Senior', 'Junior', 'Sophomore', 'Freshman']);
  const seating = out['SM Seating'];
  assert.equal(seating.rows[0][0], 'Edit the Table or Role column here, then run Check again. Sort again replaces this tab; to keep a seat, add it to Locked seats.');
  assert.deepEqual([...seating.rows[1]], ['Table', 'Name', 'Kind', 'Form', 'Role', 'Email', 'Locked', 'Why']);
  assert.equal(seating.freeze, 2);
  const tables = seating.rows.slice(2).map(r => r[0]);
  assert.deepEqual(tables, tables.slice().sort((a, b) => a - b), 'sorted by table');
  const first = seating.rows.slice(2).filter(r => r[0] === 1).map(r => r[2]);
  assert.deepEqual(first, first.slice().sort((a, b) => (a === 'Student') - (b === 'Student')), 'adults first');
});

test('text starting with =, +, - or @ is written with a leading apostrophe', () => {
  assert.equal(SMOutput.safeCell('=IMPORTXML("x")'), "'=IMPORTXML(\"x\")");
  assert.equal(SMOutput.safeCell('+1'), "'+1");
  assert.equal(SMOutput.safeCell('-x'), "'-x");
  assert.equal(SMOutput.safeCell('@here'), "'@here");
  assert.equal(SMOutput.safeCell(-3), -3);
  assert.equal(SMOutput.safeCell('Plain'), 'Plain');
  assert.deepEqual(SMOutput.grid([['a'], ['b', 'c']]).map(r => [...r]), [['a', ''], ['b', 'c']]);
  const b = loadBundle();
  b.context.SM_makePracticeData();
  b.sheet('Students').data[2][1] = '=HYPERLINK("x")';
  b.ui.answers.push({ text: 'Formula test' });
  b.context.SM_sort();
  const seating = b.sheet('SM Seating');
  const raw = [...seating.raw.values()].filter(v => String(v).includes('HYPERLINK'));
  assert.ok(raw.length && raw.every(v => v.charAt(0) === "'"), 'written with an apostrophe');
});

function sorted() {
  const b = loadBundle();
  b.context.SM_makePracticeData();
  b.ui.answers.push({ text: 'Practice run' });
  b.context.SM_sort();
  return b;
}
function seatingRow(b, pick) { const rows = b.sheet('SM Seating').data; return rows.findIndex((r, i) => i > 1 && pick(r)); }

test('Check again on an untouched list passes, and rebuilds the shared tabs without changing SM Seating', () => {
  const b = sorted(), before = JSON.stringify(b.sheet('SM Seating').data);
  b.context.SM_checkAgain();
  assert.match(b.ui.lastMessage(), /^Checked: 0 failures, \d+ warnings\. Read SM Check\.$/);
  assert.equal(JSON.stringify(b.sheet('SM Seating').data), before);
});

test('Check again catches a planted hand edit: a table over its Seats, a table not in use, someone seated twice', () => {
  const b = sorted(), rows = b.sheet('SM Seating').data;
  // Move three students from other tables to table 1, so it goes over 10.
  let moved = 0;
  for (let i = 2; i < rows.length && moved < 3; i++) if (rows[i][0] !== 1 && rows[i][2] === 'Student') { rows[i][0] = 1; moved++; }
  // Put one student at table 47, which is not in use.
  const lone = seatingRow(b, r => r[0] === 20 && r[2] === 'Student' && r[4] === '');
  rows[lone][0] = 47;
  // Copy one student's row, so they are seated twice.
  const twice = seatingRow(b, r => r[0] === 30 && r[2] === 'Student');
  rows.push(rows[twice].slice());
  b.context.SM_checkAgain();
  assert.match(b.ui.lastMessage(), /^Checked: [1-9]\d* failures/);
  const check = Object.fromEntries(b.sheet('SM Check').rows().slice(1).map(r => [r[0], r]));
  assert.equal(check['No table holds more people than its Seats'][1], 'Fail');
  assert.match(check['No table holds more people than its Seats'][2], /Table 1: 1[1-3] people for 10 seats/);
  assert.equal(check['Everyone sits at a table in use'][1], 'Fail');
  assert.match(check['Everyone sits at a table in use'][2], new RegExp('Row ' + (lone + 1) + ': .* is at table "47", which is not in use'));
  assert.equal(check['Everyone coming has exactly one seat'][1], 'Fail');
  assert.match(check['Everyone coming has exactly one seat'][2], /is seated 2 times \(row \d+, row \d+\)/);
});

test('Check again catches a guest moved away from their host, a removed person and a bad role', () => {
  const b = sorted(), rows = b.sheet('SM Seating').data;
  const guest = seatingRow(b, r => r[2] === 'Guest');
  rows[guest][0] = rows[guest][0] === 1 ? 2 : 1;
  const gone = seatingRow(b, r => r[2] === 'Student' && r[4] === '');
  const goneName = rows[gone][1];
  rows.splice(gone, 1);
  const fac = seatingRow(b, r => r[2] === 'Faculty');
  rows[fac][4] = 'Waiter';
  b.context.SM_checkAgain();
  const check = Object.fromEntries(b.sheet('SM Check').rows().slice(1).map(r => [r[0], r]));
  assert.equal(check['Households and guests sit with their faculty member'][1], 'Fail');
  assert.match(check['Everyone coming has exactly one seat'][2], new RegExp(goneName + ' is coming but has no seat'));
  assert.equal(check['Roles are Waiter or Assistant, for students only'][1], 'Fail');
  assert.ok(!b.sheet('SM By first name').rows().some(r => r[0] + ' ' + r[1] === goneName), 'shared tabs follow the edited list');
});
