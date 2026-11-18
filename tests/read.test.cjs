'use strict';
// Reading the workbook: column keywords, the season filter, forms, names, emails, the faculty
// form and the Event settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, student, answer, workbook, practiceTabs } = require('./helpers/fixtures.cjs');
const { SMRead, SMSeat } = core;

test('columns are found by keyword on messy headers, with "|" alternatives', () => {
  const headers = ['  First\n  Name ', 'TeanName', 'Email', 'Parent Email', 'Advisor  Group'];
  assert.equal(SMRead.findColumn(headers, 'FirstName|First name', true, 'Students', 'First name'), 0);
  assert.equal(SMRead.findColumn(headers, 'TeamName|TeanName|Sport', false, 'Students', 'Sport'), 1);
  assert.equal(SMRead.findColumn(headers, 'Email', true, 'Students', 'Email'), 2, 'an exact header wins over one that contains the keyword');
  assert.equal(SMRead.findColumn(headers, 'advisor group', false, 'Students', 'Advisory'), 4);
  assert.equal(SMRead.findColumn(headers, 'Dorm', false, 'Students', 'Dorm'), -1);
  assert.throws(() => SMRead.findColumn(['Student Email', 'Parent Email'], 'Email', false, 'Students', 'Email'), /more than one column.*"Student Email", "Parent Email"/);
});

test('a missing required column stops and names the keyword, the tab and the headers', () => {
  const tabs = workbook({ students: [student('Avery', 'Testwood')] });
  tabs['Students'] = tabs['Students'].map(r => r.filter((_, i) => i !== 3));
  assert.throws(() => SMRead.readWorkbook(tabs), /Students tab has no column for "Email" \(keyword "Email"\).*"FirstName"/);
});

test('a renamed header only needs a Column row in Event', () => {
  const tabs = workbook({ students: [student('Avery', 'Testwood')], event: { 'Column: Students Form': 'Class' } });
  tabs['Students'][0][4] = 'Class';
  const model = SMRead.readWorkbook(tabs);
  assert.equal(model.students[0].form, 'Senior');
});

test('missing optional columns turn their rules off, and SM Check says why', () => {
  const tabs = workbook({ students: [student('Avery', 'Testwood'), student('Blake', 'Sampleton')], tableCount: 2, rules: { gender: { on: true }, boarding: { on: true } } });
  tabs['Students'] = tabs['Students'].map(r => r.slice(0, 9));
  const model = SMRead.readWorkbook(tabs);
  assert.equal(model.has.Gender, false);
  const result = SMSeat.sort(model), rows = result.check.rows;
  assert.equal(rows.find(r => /Gender mixed/.test(r.rule)).details, 'Not checked: no Gender column.');
  assert.equal(rows.find(r => /Boarders/.test(r.rule)).details, 'Not checked: no BoardingDay column.');
});

test('the season filter keeps the latest season, or the one set in Event, and counts what it set aside', () => {
  const latest = practiceTabs();
  latest.tabs['Event'].find(r => r[0] === 'Season')[1] = '';
  const m1 = SMRead.readWorkbook(latest.tabs);
  assert.equal(m1.season.label, 'Winter 2026 - 2027');
  assert.equal(m1.students.length, 40);
  assert.ok(m1.needs.some(n => /Has no Winter 2026 - 2027 row/.test(n.problem)), 'students with no row this season are listed');
  const fall = practiceTabs();
  const m2 = SMRead.readWorkbook(fall.tabs);
  assert.equal(m2.season.label, 'Fall 2026 - 2027');
  assert.equal(m2.season.setAside, 40);
  const bad = practiceTabs({ event: { Season: 'Spring 2026 - 2027' } });
  assert.throws(() => SMRead.readWorkbook(bad.tabs), /no Students row has that season.*Fall 2026 - 2027, Winter 2026 - 2027/);
});

test('YOG is named Senior to Freshman from SchoolYear, and Form names override it', () => {
  const rows = [2027, 2028, 2029, 2030].map((y, i) => student('Avery' + 'ABCD'[i], 'Testwood', { yog: y }));
  const model = SMRead.readWorkbook(workbook({ students: rows }));
  assert.deepEqual([...model.forms], ['Senior', 'Junior', 'Sophomore', 'Freshman']);
  const renamed = SMRead.readWorkbook(workbook({ students: rows, event: { 'Form names': '2027=Sixth, 2030 = First' } }));
  assert.deepEqual([...renamed.forms], ['Sixth', 'Junior', 'Sophomore', 'First']);
  const other = SMRead.readWorkbook(workbook({ students: [student('Avery', 'Testwood', { yog: 2027, year: '' }), student('Blake', 'Testwood', { yog: 2028, year: '' })] }));
  assert.deepEqual([...other.forms], ['2027', '2028'], 'without a school year the class years stay as written');
});

test('the shown name is the nickname when there is one', () => {
  const model = SMRead.readWorkbook(workbook({ students: [student('Avery', 'Testwood', { nick: 'Ace' }), student('Blake', 'Sampleton')] }));
  assert.equal(model.students[0].name, 'Ace Testwood');
  assert.equal(model.students[0].legalFirst, 'Avery');
  assert.equal(model.students[1].name, 'Blake Sampleton');
});

test('a student with no email is seated with a row ID, and a duplicate email keeps the first row', () => {
  const model = SMRead.readWorkbook(workbook({ students: [student('Avery', 'Testwood', { email: '' }), student('Blake', 'Sampleton'), student('Blake', 'Sampleton', { team: 'Yearbook' })] }));
  assert.equal(model.students.length, 2);
  assert.equal(model.students[0].id, 'row:2');
  assert.ok(model.needs.some(n => /no email, so history can't follow this student/.test(n.problem)));
  assert.ok(model.needs.some(n => /row 4 has the same email as row 3/.test(n.problem)));
});

test('the faculty form: attending, guests split on commas and "and", seats, new and mentor', () => {
  const model = SMRead.readWorkbook(workbook({
    students: [student('Avery', 'Testwood')],
    faculty: [
      answer('Jordan Protoberry', { guests: 'Riley Protoberry and Sam Protoberry', seats: 2, newText: "I'm new to Pomfret this year" }),
      answer('Casey Sketchgate', { attend: 'no' }),
      answer('Dana Pilotlane', { attend: '', newText: "I'd be glad to sit with a new colleague", guests: 'Pat Visitor, Lee Visitor & Kim Visitor', seats: 1 }),
      answer('Emery Modelmere', { seats: 'two' })
    ]
  }));
  const by = Object.fromEntries(model.adults.map(a => [a.name, a]));
  assert.equal(by['Jordan Protoberry'].attending, true);
  assert.deepEqual([...by['Jordan Protoberry'].guestNames], ['Riley Protoberry', 'Sam Protoberry']);
  assert.equal(by['Jordan Protoberry'].guestSeats, 2);
  assert.equal(by['Jordan Protoberry'].isNew, true);
  assert.equal(by['Casey Sketchgate'].attending, false);
  assert.equal(by['Dana Pilotlane'].attending, true, 'a blank answer means coming');
  assert.equal(by['Dana Pilotlane'].isMentor, true);
  assert.equal(by['Dana Pilotlane'].guestSeats, 3, 'more names than seats holds a seat per name');
  assert.ok(model.needs.some(n => /Named 3 guests but asked for 1 seat\./.test(n.problem)));
  assert.equal(by['Emery Modelmere'].guestSeats, 0);
  assert.ok(model.needs.some(n => /Guest seats answer "two" is not a number/.test(n.problem)));
});

test('faculty who name each other are a household, and take no guest seat', () => {
  const model = SMRead.readWorkbook(workbook({
    students: [student('Avery', 'Testwood')],
    faculty: [answer('Jordan Protoberry', { guests: 'Riley Protoberry', seats: 1 }), answer('Riley Protoberry', { guests: '', seats: 0 }), answer('Casey Sketchgate', { colleagues: 'Jordan Protoberry, Nobody Atall' })]
  }));
  const by = Object.fromEntries(model.adults.map(a => [a.name, a]));
  assert.deepEqual([...by['Jordan Protoberry'].householdIds], ['riley.protoberry@example.org']);
  assert.deepEqual([...by['Riley Protoberry'].householdIds], ['jordan.protoberry@example.org'], 'the link goes both ways');
  assert.equal(by['Jordan Protoberry'].guestSeats, 0);
  assert.deepEqual([...by['Casey Sketchgate'].colleagueIds], ['jordan.protoberry@example.org']);
  assert.ok(model.needs.some(n => /Colleague "Nobody Atall" doesn't match anyone/.test(n.problem)));
});

test('a faculty member who answered twice is read from the later answer', () => {
  const model = SMRead.readWorkbook(workbook({
    students: [student('Avery', 'Testwood')],
    faculty: [answer('Jordan Protoberry', { attend: 'Yes', time: '11/06/2026 10:00:00' }), answer('Jordan Protoberry', { attend: 'No', time: '11/04/2026 10:00:00' })]
  }));
  assert.equal(model.adults.length, 1);
  assert.equal(model.adults[0].attending, true);
  assert.ok(model.needs.some(n => /Answered the faculty form twice \(rows 3 and 2\)\. Used the later answer, row 2/.test(n.problem)));
});

test('the Faculty list is joined by email, and the didn\'t-answer setting decides who is seated', () => {
  const o = {
    students: [student('Avery', 'Testwood')],
    faculty: [answer('Jordan Protoberry'), answer('Off List')],
    list: [['Jordan Protoberry', 'JORDAN.PROTOBERRY@example.org', 'Birch'], ['Casey Sketchgate', 'casey.sketchgate@example.org', 'Cedar']]
  };
  const dont = SMRead.readWorkbook(workbook(o));
  const by = Object.fromEntries(dont.adults.map(a => [a.name, a]));
  assert.equal(by['Jordan Protoberry'].group, 'Birch');
  assert.equal(by['Casey Sketchgate'].attending, false);
  assert.ok(dont.needs.some(n => n.name === 'Casey Sketchgate' && /didn't answer the faculty form/.test(n.problem)));
  assert.ok(dont.needs.some(n => n.name === 'Off List' && /not on Faculty list\. Seated anyway/.test(n.problem)));
  const seat = SMRead.readWorkbook(workbook({ ...o, event: { "Faculty who didn't answer": '  SEAT ' } }));
  assert.equal(seat.adults.find(a => a.name === 'Casey Sketchgate').attending, true);
});

test('words people type are read ignoring case and spaces at the ends, with defaults for the rest', () => {
  const model = SMRead.readWorkbook(workbook({
    students: [student('Avery', 'Testwood')],
    event: { Sort: '  together ', 'Waiter forms': ' junior, SOPHOMORE ', Seed: 'abc', 'Seats per table': '0' }
  }));
  assert.equal(model.event.sort, 'Together');
  assert.deepEqual([...model.event.waiterForms], ['junior', 'sophomore']);
  assert.equal(model.event.seed, 1);
  assert.equal(model.event.seatsPerTable, 10);
  assert.ok(model.warnings.some(w => /Event "Seed": "abc" is not a whole number/.test(w)));
  assert.equal(model.rules.find(r => r.id === 'forms').on, true);
});

test('dates are read from date cells and typed text', () => {
  assert.equal(SMRead.dateKey(new Date(2026, 11, 15)), '2026-12-15');
  assert.equal(SMRead.dateKey('2026-12-5'), '2026-12-05');
  assert.equal(SMRead.dateKey('12/15/2026'), '2026-12-15');
  assert.equal(SMRead.dateKey('soon'), '');
  assert.equal(SMRead.dateKey('2026-13-01'), '');
});
