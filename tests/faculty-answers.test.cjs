'use strict';
// The faculty form's answers the way people really type them: "No" and "N/A" in question 4,
// "my wife Sarah", a spouse named inside a sentence, couples who don't name each other, and
// Faculty list names. Every name is invented and every email ends in @example.org.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, answer, workbook } = require('./helpers/fixtures.cjs');
const { SMRead, SMSeat, SMOutput } = core;

const students = [];
for (let i = 0; i < 48; i++) students.push(student('Kid' + i, 'Testwood' + i, { yog: 2027 + (i % 4) }));

function read(faculty, o = {}) { return SMRead.readWorkbook(workbook(Object.assign({ students, faculty, tableCount: 6 }, o))); }
function byName(model) { const by = {}; model.adults.forEach(a => { by[a.name] = a; }); return by; }
// The SM Needs you problems for one person, as a plain array of this realm (see helpers/core.cjs).
function needsFor(model, name) { return [...model.needs.filter(n => n.name === name).map(n => n.problem)]; }

// ---------- Question 4: guests ----------

test('an answer that means nobody holds no guest seat and needs no one', () => {
  const nobody = ['No', 'none', 'N/A', 'n/a', 'NA', 'N.A.', 'Nope', 'Nobody', 'No one', 'Not this time', 'None this time', 'No, thank you',
    'Just me', 'Only me', 'Myself', '-', 'No, just me', 'No guests'];
  nobody.forEach((typed, i) => {
    for (const seats of ['', 0]) {
      const model = read([answer('Ann Alpha' + i, { guests: typed, seats })]), a = model.adults[0];
      assert.deepEqual([...a.guestNames], [], typed);
      assert.equal(a.guestSeats, 0, typed);
      assert.deepEqual(needsFor(model, a.name), [], typed + ' adds no SM Needs you row');
    }
  });
});

test('"Yes" and words like "my wife" are dropped, leaving the names', () => {
  const by = byName(read([
    answer('Eve Epsilon', { guests: 'Yes, my wife Sarah Rivera', seats: 1 }),
    answer('Dee Delta', { guests: 'My husband, John', seats: 1 }),
    answer('Kit Kappa', { guests: 'Our kids Mia and Leo', seats: 2 }),
    answer('Lu Lambda', { guests: 'Sam Lambda (son)', seats: 1 })
  ]));
  assert.deepEqual([...by['Eve Epsilon'].guestNames], ['Sarah Rivera']);
  assert.equal(by['Eve Epsilon'].guestSeats, 1);
  assert.deepEqual([...by['Dee Delta'].guestNames], ['John']);
  assert.equal(by['Dee Delta'].guestSeats, 1);
  assert.deepEqual([...by['Kit Kappa'].guestNames], ['Mia', 'Leo']);
  assert.equal(by['Kit Kappa'].guestSeats, 2);
  assert.deepEqual([...by['Lu Lambda'].guestNames], ['Sam Lambda']);
});

test('someone mentioned with no name or seat count still gets a seat, and SM Needs you says so', () => {
  const model = read([
    answer('Yan Yes', { guests: 'Yes', seats: '' }),
    answer('Wes Wife', { guests: 'My wife and son', seats: '' }),
    answer('Zed Zero', { guests: 'Yes', seats: 0 })
  ]), by = byName(model);
  assert.equal(by['Yan Yes'].guestSeats, 1);
  assert.match(needsFor(model, 'Yan Yes')[0], /^Said someone is joining \("Yes"\) but didn't say how many seats\. Held 1 seat\.$/);
  assert.equal(by['Wes Wife'].guestSeats, 2, 'one seat for each person mentioned');
  assert.equal(by['Zed Zero'].guestSeats, 0, 'an explicit 0 is kept');
  assert.match(needsFor(model, 'Zed Zero')[0], /asked for 0 seats, so none was held/);
});

test('more names than seats holds a seat per name, and SM Needs you lists the names', () => {
  const model = read([answer('Dana Pilotlane', { guests: 'Pat Visitor, Lee Visitor & Kim Visitor', seats: 1 })]);
  assert.equal(model.adults[0].guestSeats, 3);
  assert.deepEqual(needsFor(model, 'Dana Pilotlane'), ['Named 3 guests but asked for 1 seat. Held 3 seats (Pat Visitor, Lee Visitor, Kim Visitor).']);
});

test('the shared tabs never show "No", "Yes" or "My husband" as a guest', () => {
  const model = read([
    answer('Ann Alpha', { guests: 'No', seats: '' }), answer('Ben Beta', { guests: 'None', seats: 0 }), answer('Cal Gamma', { guests: 'N/A' }),
    answer('Dee Delta', { guests: 'My husband, John', seats: 1 }), answer('Eve Epsilon', { guests: 'Yes, my wife Sarah', seats: 1 }),
    answer('Hal Eta', { guests: 'Just me' })
  ]);
  const out = SMOutput.allTabs(model, SMSeat.sort(model), true);
  // Guest lines on SM By table read "<guest> (guest of <host>)"; SM Faculty lists guests in column 3.
  const guestLines = out['SM By table'].rows.map(r => String(r[0])).filter(v => / \(guest of /.test(v));
  const facultyGuests = out['SM Faculty'].rows.slice(1).map(r => String(r[2])).filter(v => v !== '');
  for (const bad of ['No', 'None', 'N/A', 'Yes', 'My husband', 'Just me']) {
    assert.ok(!guestLines.some(v => v.startsWith(bad + ' (guest of')), bad + ' shows as a guest on SM By table');
    assert.ok(!facultyGuests.some(v => v.split(', ').includes(bad)), bad + ' shows as a guest on SM Faculty');
  }
  assert.ok(guestLines.includes('John (guest of Dee Delta)'));
  assert.ok(guestLines.includes('Sarah (guest of Eve Epsilon)'));
});

// ---------- Question 6: colleagues ----------

test('"No preference" and the like in question 6 ask for nobody and need no one', () => {
  const model = read([answer('Ida Theta', { colleagues: 'No preference' }), answer('Jo Iota', { colleagues: 'Anyone' }), answer('Kay Kappa', { colleagues: 'N/A' })]);
  model.adults.forEach(a => {
    assert.deepEqual([...a.colleagueIds], [], a.name);
    assert.deepEqual(needsFor(model, a.name), [], a.name);
  });
});

test('a colleague named inside a longer answer is found', () => {
  const by = byName(read([answer('Jane Brightwater'), answer('Ida Theta', { colleagues: 'Jane Brightwater from the science department' })]));
  assert.deepEqual([...by['Ida Theta'].colleagueIds], ['jane.brightwater@example.org']);
});

// ---------- Couples ----------

test('a faculty spouse named inside a sentence makes a household and holds no guest seat', () => {
  for (const typed of ['My husband John Smithson', 'John Smithson (husband)', 'John Smithson, also faculty', 'my husband John']) {
    const by = byName(read([answer('Jane Smithson', { guests: typed, seats: 1 }), answer('John Smithson', { guests: 'No' })]));
    assert.deepEqual([...by['Jane Smithson'].householdIds], ['john.smithson@example.org'], typed);
    assert.deepEqual([...by['John Smithson'].householdIds], ['jane.smithson@example.org'], typed + ' (both ways)');
    assert.deepEqual([...by['Jane Smithson'].guestNames], [], typed + ' holds no guest');
    assert.equal(by['Jane Smithson'].guestSeats, 0, typed);
  }
});

test('a spouse on the Faculty list who skipped the form is seated with the partner who named them', () => {
  const list = [['Jane Smithson', 'jane.smithson@example.org', ''], ['John Smithson', 'john.smithson@example.org', '']];
  const model = read([answer('Jane Smithson', { guests: 'John Smithson', seats: 1 })], { list }), by = byName(model);
  assert.equal(by['John Smithson'].attending, true);
  assert.deepEqual([...by['Jane Smithson'].householdIds], ['john.smithson@example.org']);
  assert.equal(by['Jane Smithson'].guestSeats, 0);
  assert.deepEqual(needsFor(model, 'John Smithson'), ['Named by Jane Smithson as joining them, so seated together, but didn\'t answer the form.']);
  const result = SMSeat.sort(model), tables = {};
  result.rows.forEach(r => { tables[r.name] = r.table; });
  assert.equal(tables['John Smithson'], tables['Jane Smithson']);
});

test('a spouse who answered No is not seated, and SM Needs you says the two answers disagree', () => {
  const model = read([answer('Jane Smithson', { guests: 'John Smithson', seats: 1 }), answer('John Smithson', { attend: 'No' })]), by = byName(model);
  assert.deepEqual([...by['Jane Smithson'].householdIds], []);
  assert.equal(by['Jane Smithson'].guestSeats, 0);
  assert.deepEqual(needsFor(model, 'Jane Smithson'), ['Jane Smithson named John Smithson as joining, but John Smithson answered No, so John Smithson is not seated.']);
  assert.ok(!SMSeat.sort(model).rows.some(r => r.name === 'John Smithson'));
});

test('faculty who share a last name sit together even when neither named the other', () => {
  const faculty = [answer('Pat Rivera', { guests: 'No', seats: 0 }), answer('Lee Rivera', { guests: 'None', seats: 0 })];
  for (const n of ['Max Other', 'Sam Other', 'Ali Other', 'Bo Other', 'Cy Other', 'Di Other', 'Ed Other', 'Flo Other']) faculty.push(answer(n));
  // Other surnames that differ, so only the Riveras share one.
  faculty.slice(2).forEach((row, i) => { row[2] = row[2].replace('Other', 'Other' + i); row[1] = row[1].replace('other', 'other' + i); });
  const model = read(faculty), result = SMSeat.sort(model), tables = {}, why = {};
  result.rows.forEach(r => { tables[r.name] = r.table; why[r.name] = r.why; });
  assert.equal(tables['Pat Rivera'], tables['Lee Rivera']);
  assert.equal(why['Pat Rivera'], 'Same last name as Lee Rivera');
  assert.equal(why['Lee Rivera'], 'Same last name as Pat Rivera');
  assert.equal(result.check.failures, 0);
});

// ---------- Faculty list names ----------

test('the Faculty list name is shown, and the name typed into the form still matches', () => {
  const list = [['Jonathan Brightwater', 'jon.brightwater@example.org', ''], ['Ida Theta', 'ida.theta@example.org', '']];
  const faculty = [answer('jon brightwater', { email: 'jon.brightwater@example.org' }), answer('Ida Theta', { colleagues: 'Jon Brightwater' })];
  const model = read(faculty, { list }), by = byName(model);
  assert.ok(by['Jonathan Brightwater'], 'the list name is kept');
  assert.deepEqual([...by['Ida Theta'].colleagueIds], ['jon.brightwater@example.org'], 'the typed name still matches');
  const out = SMOutput.allTabs(model, SMSeat.sort(model), true);
  assert.ok(out['SM Faculty'].rows.some(r => r[0] === 'Jonathan Brightwater'));
  assert.ok(!out['SM Faculty'].rows.some(r => r[0] === 'jon brightwater'));
});

test('a name typed as "Last, First" is sorted by its last name', () => {
  const by = byName(read([answer('Brightwater, Jonathan', { email: 'jb@example.org' })]));
  assert.equal(by['Brightwater, Jonathan'].last, 'Brightwater');
  assert.equal(by['Brightwater, Jonathan'].legalFirst, 'Jonathan');
});
