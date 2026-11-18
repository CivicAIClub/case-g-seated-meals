'use strict';
// Sort, steps 1 to 7: hard limits, faculty, the Mixed and Together sorts, rule ranking, repeats,
// the same result for the same Seed, and speed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, answer, workbook, practiceTabs, tableOf } = require('./helpers/fixtures.cjs');
const { SMRead, SMSeat } = core;

function practiceSort(o = {}) {
  const { tabs, data } = practiceTabs({ withPast: true, ...o });
  const model = SMRead.readWorkbook(tabs);
  return { model, result: SMSeat.sort(model), data };
}
function perTable(result) {
  const t = {};
  for (const r of result.rows) {
    const x = t[r.table] = t[r.table] || { total: 0, adults: 0, forms: {} };
    x.total++;
    if (r.kind === 'Faculty') x.adults++;
    if (r.kind === 'Student') x.forms[r.form] = (x.forms[r.form] || 0) + 1;
  }
  return t;
}
const base = practiceSort();

test('everyone coming is seated exactly once, no table is over its Seats, totals are within one', () => {
  const { model, result } = base, ctx = result.ctx;
  const ids = result.rows.filter(r => r.person).map(r => r.person.id);
  assert.equal(new Set(ids).size, ids.length, 'nobody twice');
  assert.equal(ids.length, ctx.students.length + ctx.adults.length, 'everyone coming');
  const absent = new Set(model.notAttending.map(r => r.email.toLowerCase()));
  assert.ok(ids.every(id => !absent.has(id)), 'nobody from Not attending');
  const t = perTable(result), totals = Object.values(t).map(x => x.total);
  assert.equal(Object.keys(t).length, 46);
  Object.entries(t).forEach(([num, x]) => assert.ok(x.total <= 10, 'table ' + num));
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
  Object.values(t).forEach(x => assert.ok(x.adults >= 1, 'every table has faculty'));
  assert.equal(result.check.failures, 0);
});

test('Mixed meets rules 1 and 2 on the practice data, matching the September 2026 baseline', () => {
  for (const x of Object.values(perTable(base.result))) {
    assert.ok(Object.keys(x.forms).length >= 3, 'at least 3 forms');
    assert.ok(Object.values(x.forms).every(n => n <= 3), 'at most 3 from one form');
  }
  const rows = base.result.check.rows;
  assert.equal(rows.find(r => r.rule.startsWith('Rule 1:')).result, 'Pass');
  assert.equal(rows.find(r => r.rule.startsWith('Rule 2:')).result, 'Pass');
});

test('households and guests sit together, and each new faculty member has a mentor', () => {
  const { result } = base, at = tableOf(result);
  base.data.planted.couples.forEach(([a, b]) => assert.equal(at[a], at[b]));
  result.rows.filter(r => r.kind === 'Guest').forEach(g => assert.equal(g.table, at[g.host.id]));
  assert.equal(result.rows.filter(r => r.kind === 'Guest').length, 1 + 2 + 1 + 2 + 1, 'every guest seat is held');
  const mentors = new Set(base.data.planted.mentors.map(e => at[e]));
  base.data.planted.newFaculty.forEach(e => assert.ok(mentors.has(at[e]), 'mentor at the new colleague\'s table'));
});

test('colleagues who asked for each other sit together when a table has room', () => {
  const at = tableOf(base.result), [a, b, c] = base.data.planted.triangle;
  assert.ok(at[a] === at[b] || at[b] === at[c] || at[a] === at[c]);
});

test('locked seats are honored, and bad locks are reported and skipped', () => {
  const students = [];
  for (let i = 0; i < 12; i++) students.push(student('Kid' + 'ABCDEFGHIJKL'[i], 'Testwood', { yog: 2027 + (i % 4) }));
  const tabs = workbook({
    students, tableCount: 3, seats: 5, faculty: [answer('Jordan Protoberry'), answer('Casey Sketchgate', { guests: 'Pat Visitor', seats: 1 })],
    locks: [
      ['kida.testwood@example.org', '', 2, 'Needs the ramp'],
      ['', 'Casey Sketchgate', 3, 'Host'],
      ['kidb.testwood@example.org', '', 9, 'Wrong table'],
      ['nobody@example.org', '', 1, 'Not coming'],
      ['kida.testwood@example.org', '', 1, 'Twice']
    ]
  });
  const model = SMRead.readWorkbook(tabs), result = SMSeat.sort(model), at = tableOf(result);
  assert.equal(at['kida.testwood@example.org'], 2);
  assert.equal(at['casey.sketchgate@example.org'], 3);
  assert.equal(result.rows.find(r => r.kind === 'Guest').table, 3);
  const locked = result.rows.find(r => r.email === 'kida.testwood@example.org');
  assert.equal(locked.locked, true);
  assert.equal(locked.why, 'Locked: Needs the ramp');
  const problems = result.needs.filter(n => n.section === 'Lock problems').map(n => n.problem).join('\n');
  assert.match(problems, /row 4: Table "9" is not in use/);
  assert.match(problems, /row 5: nobody@example.org is not someone who is coming/);
  assert.match(problems, /row 6: .* is locked twice/);
  assert.equal(result.check.rows.find(r => r.rule === 'Locked seats are honored').result, 'Pass');
});

test('a lock to a full table is reported, and a table with no adult when there are too few is a warning', () => {
  const tabs = workbook({
    students: [student('Avery', 'Testwood'), student('Blake', 'Testwood'), student('Casey', 'Testwood')], tableCount: 3, seats: 1,
    faculty: [answer('Jordan Protoberry')], locks: [['avery.testwood@example.org', '', 1, ''], ['blake.testwood@example.org', '', 1, '']]
  });
  const result = SMSeat.sort(SMRead.readWorkbook(tabs));
  assert.ok(result.needs.some(n => /row 3: table 1 is already full/.test(n.problem)));
  assert.ok(result.needs.some(n => n.section === 'Could not seat'), 'more people than seats');
  const adult = result.check.rows.find(r => r.rule === 'Every table has at least one adult');
  assert.equal(adult.result, 'Warning');
  assert.match(adult.details, /Only 1 faculty for 3 tables/);
});

test('rules are compared by rank: a change that helps rule 3 but breaks rule 1 is refused', () => {
  // Violations per rule in rank order: [rule 1, rule 3]. Helping rule 3 while breaking rule 1 is refused.
  assert.equal(SMSeat.improvedAt([0, 2], [1, 0]), -1);
  assert.equal(SMSeat.improvedAt([0, 2], [0, 1]), 1, 'helping rule 3 with rule 1 unchanged is kept');
  assert.equal(SMSeat.improvedAt([2, 0], [1, 5]), 0, 'helping rule 1 is kept even if rule 3 gets worse');
  assert.equal(SMSeat.improvedAt([1, 1], [1, 1]), -1, 'no change is not better');
});

test('the ranking decides what Sort gives up when two rules conflict', () => {
  // Two seniors who sat at table 1 last time and two juniors who sat at table 2. Mixing the forms
  // (rule 1, at least 2 forms) puts someone back at their old table number (rule 8); keeping each
  // form together avoids that. Whichever rule is ranked higher wins.
  const students = [student('SeniorA', 'Testwood', { yog: 2027 }), student('SeniorB', 'Testwood', { yog: 2027 }), student('JuniorA', 'Testwood', { yog: 2028 }), student('JuniorB', 'Testwood', { yog: 2028 })];
  const history = [['Last', '2026-11-01', 'seniora.testwood@example.org', '', 1], ['Last', '2026-11-01', 'seniorb.testwood@example.org', '', 1],
    ['Last', '2026-11-01', 'juniora.testwood@example.org', '', 2], ['Last', '2026-11-01', 'juniorb.testwood@example.org', '', 2]];
  const off = { perForm: { on: false }, tablemates: { on: false }, waited: { on: false }, sameFaculty: { on: false } };
  const run = (formsRank, sameRank) => SMSeat.sort(SMRead.readWorkbook(workbook({ students, tableCount: 2, seats: 2, seatingHistory: history,
    rules: { ...off, forms: { value: 2, rank: formsRank }, sameStudents: { rank: sameRank } } })));
  const result = (res, words) => res.check.rows.find(r => r.rule.includes(words)).result;
  const formsFirst = run(1, 2), sameFirst = run(2, 1);
  assert.equal(result(formsFirst, 'forms at each table'), 'Pass');
  assert.equal(result(formsFirst, 'Students not at the same table number'), 'Warning', 'the lower-ranked rule gives way');
  assert.equal(result(sameFirst, 'Students not at the same table number'), 'Pass');
  assert.equal(result(sameFirst, 'forms at each table'), 'Warning', 'and with the ranks swapped, the forms rule gives way');
  assert.match(sameFirst.rows.find(r => r.name === 'SeniorA Testwood').why, /^Swapped to meet rule \d+$/);
});

test('rules 3 and 8 cut repeats against seeded history compared with the same sort with them off', () => {
  const off = practiceSort({ rules: { tablemates: { on: false }, sameStudents: { on: false } } }).result;
  function repeats(result) {
    const last = result.ctx.last.tableById, byTable = {};
    let pairs = 0, same = 0;
    for (const r of result.rows) {
      if (!r.person || last[r.person.id] === undefined) continue;
      const key = r.table + '|' + last[r.person.id];
      pairs += byTable[key] || 0;
      byTable[key] = (byTable[key] || 0) + 1;
      if (r.kind === 'Student' && last[r.person.id] === r.table) same++;
    }
    return { pairs, same };
  }
  const a = repeats(off), b = repeats(base.result);
  assert.ok(a.pairs > 5 && a.same > 0, 'with the rules off, repeats happen by chance');
  assert.ok(b.pairs < a.pairs / 3, 'rule 3 cuts repeat tablemates (' + a.pairs + ' -> ' + b.pairs + ')');
  assert.ok(b.same < a.same, 'rule 8 cuts same table numbers (' + a.same + ' -> ' + b.same + ')');
});

test('the same input and Seed give the same seating; a different Seed gives a different one', () => {
  const again = practiceSort().result, other = practiceSort({ event: { Seed: 2 } }).result;
  const plain = r => JSON.stringify(r.rows.map(x => [x.table, x.name, x.role, x.why]));
  assert.equal(plain(again), plain(base.result));
  assert.notEqual(plain(other), plain(base.result));
});

test('Sort on the practice data runs in under 5 seconds', () => {
  const { tabs } = practiceTabs({ withPast: true }), start = process.hrtime.bigint();
  SMSeat.sort(SMRead.readWorkbook(tabs));
  assert.ok(Number(process.hrtime.bigint() - start) / 1e6 < 5000);
});

test('Sort scales to 360 students and 95 faculty in under 5 seconds', () => {
  const students = [], faculty = [];
  for (let i = 0; i < 360; i++) students.push(student('Kid' + i, 'Scaleton', { yog: 2027 + (i % 4), advisory: 'Group ' + (i % 50) }));
  for (let i = 0; i < 95; i++) faculty.push(answer('Adult' + i + ' Scalewood'));
  const history = students.map((r, i) => ['Last', '2026-11-01', r[3], '', 1 + (i * 7) % 46]);
  const tabs = workbook({ students, faculty, seatingHistory: history, event: { 'Seats per table': 11 } }), start = process.hrtime.bigint();
  const result = SMSeat.sort(SMRead.readWorkbook(tabs));
  assert.ok(Number(process.hrtime.bigint() - start) / 1e6 < 5000);
  assert.equal(result.check.failures, 0);
});

test('Together keeps groups whole when they fit, and splits a big group over neighbors in one row', () => {
  const students = [];
  for (let i = 0; i < 14; i++) students.push(student('Big' + i, 'Testwood', { advisory: 'Lantern' }));
  for (let i = 0; i < 5; i++) students.push(student('Small' + i, 'Testwood', { advisory: 'Pebble' }));
  for (let i = 0; i < 4; i++) students.push(student('Tiny' + i, 'Testwood', { advisory: 'Cedar' }));
  const tables = [[1, 'A', 'Yes', 8], [2, 'A', 'Yes', 8], [3, 'B', 'Yes', 8], [4, 'B', 'Yes', 8], [5, 'B', 'Yes', 8]];
  const tabs = workbook({ students, tables, event: { Sort: 'Together' }, faculty: [answer('Lantern Advisor')], list: [['Lantern Advisor', 'lantern.advisor@example.org', 'Lantern']] });
  const result = SMSeat.sort(SMRead.readWorkbook(tabs));
  const tablesOf = g => [...new Set(result.rows.filter(r => r.kind === 'Student' && r.person.advisory === g).map(r => r.table))].sort();
  assert.deepEqual(tablesOf('Pebble').length, 1, 'a group that fits stays whole');
  assert.deepEqual(tablesOf('Cedar').length, 1);
  const big = tablesOf('Lantern');
  assert.equal(big.length, 2, 'split over as few tables as possible');
  assert.ok(SMSeat.neighborsInOneRow(big, result.ctx), 'at neighboring tables in one row');
  assert.ok(big.includes(tableOf(result)['lantern.advisor@example.org']), 'the advisor sits with the advisory');
  assert.equal(result.check.rows.find(r => r.rule.startsWith('Rule 5:')).result, 'Pass');
  assert.match(result.rows.find(r => r.name === 'Big0 Testwood').why, /^Advisory: Lantern$/);
});

test('Together on the practice data seats everyone and meets rule 5', () => {
  const { result } = practiceSort({ event: { Sort: 'Together' } });
  assert.equal(result.check.failures, 0);
  assert.equal(result.check.rows.find(r => r.rule.startsWith('Rule 5:')).result, 'Pass');
});
