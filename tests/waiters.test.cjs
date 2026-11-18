'use strict';
// Step 8: waiters and assistants, picked fairly across the school year, never by the alphabet.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, workbook, practiceTabs } = require('./helpers/fixtures.cjs');
const { SMRead, SMSeat } = core;

function practice(o = {}) {
  const { tabs } = practiceTabs({ withPast: true, ...o });
  return SMSeat.sort(SMRead.readWorkbook(tabs));
}
const base = practice();
function roles(result) { return result.rows.filter(r => r.kind === 'Student' && r.role); }

test('one waiter and one assistant per table by default, and nobody gets both', () => {
  const byTable = {};
  for (const r of roles(base)) (byTable[r.table] = byTable[r.table] || []).push(r.role);
  assert.equal(Object.keys(byTable).length, 46);
  Object.values(byTable).forEach(list => assert.deepEqual(list.sort(), ['Assistant', 'Waiter']));
  const ids = roles(base).map(r => r.person.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('Waiter forms and Assistant forms are respected', () => {
  const result = practice({ event: { 'Waiter forms': 'Junior, Sophomore', 'Assistant forms': 'Freshman' } });
  roles(result).forEach(r => {
    if (r.role === 'Waiter') assert.ok(['Junior', 'Sophomore'].includes(r.form), r.form);
    else assert.equal(r.form, 'Freshman');
  });
});

test('the student who has waited the fewest times goes first, then one who didn\'t wait last time', () => {
  const students = [student('Often', 'Testwood'), student('Once', 'Testwood'), student('Never', 'Testwood'), student('Lasttime', 'Testwood')];
  const waiters = [
    ['Dinner A', '2026-09-22', 'often.testwood@example.org', '', 'Waiter'], ['Dinner B', '2026-10-20', 'often.testwood@example.org', '', 'Assistant'],
    ['Dinner A', '2026-09-22', 'once.testwood@example.org', '', 'Waiter'], ['Dinner B', '2026-10-20', 'lasttime.testwood@example.org', '', 'Waiter']
  ];
  const one = SMSeat.sort(SMRead.readWorkbook(workbook({ students, tableCount: 1, waiterHistory: waiters })));
  const role = name => one.rows.find(r => r.name === name + ' Testwood').role;
  assert.equal(role('Never'), 'Waiter', 'never waited: first');
  assert.equal(role('Once'), 'Assistant', 'waited once, but not last time: before the one who waited last time');
  assert.equal(role('Lasttime'), '');
  assert.equal(role('Often'), '');
});

test('waiting before August 1 does not count toward this school year', () => {
  const students = [student('Lastyear', 'Testwood'), student('Thisyear', 'Testwood')];
  const waiters = [['Old dinner', '2026-05-01', 'lastyear.testwood@example.org', '', 'Waiter'], ['Old dinner', '2026-05-01', 'lastyear.testwood@example.org', '', 'Waiter'],
    ['Fall dinner', '2026-09-01', 'thisyear.testwood@example.org', '', 'Waiter'], ['Fall dinner 2', '2026-10-01', 'lastyear.testwood@example.org', '', 'Assistant']];
  const res = SMSeat.sort(SMRead.readWorkbook(workbook({ students, tableCount: 1, waiterHistory: waiters, event: { 'Assistants per table': 0 } })));
  assert.equal(res.rows.find(r => r.name === 'Thisyear Testwood').role, 'Waiter', 'both waited once this year; the one who waited last time is not picked');
});

test('nobody who waited at the last event is picked when someone else can be', () => {
  const lastIds = new Set(base.ctx.waiting.lastIds ? Object.keys(base.ctx.waiting.lastIds) : []);
  assert.ok(lastIds.size > 50, 'the practice history has a last event with waiters');
  const byTable = {};
  for (const r of base.rows) if (r.kind === 'Student') (byTable[r.table] = byTable[r.table] || []).push(r);
  for (const list of Object.values(byTable)) {
    const fresh = list.filter(r => !lastIds.has(r.person.id) && !base.ctx.waiting.countById[r.person.id]);
    const picked = list.filter(r => r.role);
    if (fresh.length >= 2) picked.forEach(r => assert.ok(!lastIds.has(r.person.id), r.name + ' waited last time'));
  }
});

test('never the alphabet: waiters\' last initials are spread across the alphabet', () => {
  const initials = {};
  roles(base).forEach(r => { const c = r.person.last.charAt(0); initials[c] = (initials[c] || 0) + 1; });
  const firstNames = {};
  roles(base).forEach(r => { const c = r.person.shownFirst.charAt(0); firstNames[c] = (firstNames[c] || 0) + 1; });
  assert.ok(Object.keys(firstNames).length >= 15, 'first initials spread: ' + JSON.stringify(firstNames));
  const all = {};
  base.rows.filter(r => r.kind === 'Student').forEach(r => { const c = r.person.last.charAt(0); all[c] = (all[c] || 0) + 1; });
  // The practice surnames start with a handful of letters; waiters follow the same mix, not A to G.
  Object.keys(all).forEach(c => {
    const share = (initials[c] || 0) / roles(base).length, expected = all[c] / base.rows.filter(r => r.kind === 'Student').length;
    assert.ok(Math.abs(share - expected) < 0.12, c + ': ' + share.toFixed(2) + ' vs ' + expected.toFixed(2));
  });
});

test('a table with no eligible student gets no waiter, and SM Check says so', () => {
  const students = [student('Senior', 'Testwood', { yog: 2027 }), student('Junior', 'Testwood', { yog: 2028 }), student('Junior2', 'Testwood', { yog: 2028 })];
  const res = SMSeat.sort(SMRead.readWorkbook(workbook({ students, tables: [[1, 'A', 'Yes', 2], [2, 'A', 'Yes', 1]], event: { 'Waiter forms': 'Senior', 'Assistant forms': 'Senior' },
    locks: [['senior.testwood@example.org', '', 1, ''], ['junior.testwood@example.org', '', 2, '']] })));
  const row = res.check.rows.find(r => r.rule === 'Every table has its waiter and assistant');
  assert.equal(row.result, 'Warning');
  assert.match(row.details, /Table 2: 0 waiters, 0 assistants \(not enough students from the Waiter or Assistant forms\)/);
});

test('rule 4 is fixed by a swap when possible', () => {
  // Two students have waited before; with rule 4 off, some Seeds put both at one table.
  const students = ['A', 'B', 'C', 'D', 'E', 'F'].map((x, i) => student('Kid' + x, 'Testwood', { yog: 2027 + (i % 2) }));
  const waiters = [['Dinner', '2026-10-01', 'kida.testwood@example.org', '', 'Waiter'], ['Dinner', '2026-10-01', 'kidc.testwood@example.org', '', 'Waiter']];
  let broken = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const o = { students, tableCount: 2, seats: 3, waiterHistory: waiters, event: { Seed: seed }, rules: { forms: { on: false }, perForm: { on: false } } };
    const off = SMSeat.sort(SMRead.readWorkbook(workbook({ ...o, rules: { ...o.rules, waited: { on: false } } })));
    const on = SMSeat.sort(SMRead.readWorkbook(workbook(o)));
    const tables = r => new Set(r.rows.filter(x => ['kida.testwood@example.org', 'kidc.testwood@example.org'].includes(x.email)).map(x => x.table)).size;
    if (tables(off) === 1) broken++;
    assert.equal(tables(on), 2, 'Seed ' + seed + ': with rule 4 on, each table has someone who waited');
    assert.equal(on.check.rows.find(r => r.rule.startsWith('Rule 4:')).result, 'Pass');
  }
  assert.ok(broken > 0, 'the fixture does break rule 4 for some Seeds when the rule is off');
});
