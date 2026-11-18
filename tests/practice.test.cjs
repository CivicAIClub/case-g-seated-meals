'use strict';
// The practice data: the same on every run, in the real export's layout, with every planted case.
const test = require('node:test');
const assert = require('node:assert/strict');
const { core, STUDENT_HEADERS, FACULTY_HEADERS, practiceTabs } = require('./helpers/fixtures.cjs');
const { SMPractice, SMRead } = core;

test('practice data is identical on two runs', () => {
  assert.equal(JSON.stringify(SMPractice.make()), JSON.stringify(SMPractice.make()));
});

test('Students uses the real export\'s headers, in order, typo included', () => {
  const s = SMPractice.make().tabs['Students'];
  assert.deepEqual([...s[0]], STUDENT_HEADERS);
  assert.deepEqual([...SMPractice.make().tabs['Faculty'][0]], FACULTY_HEADERS);
});

test('the practice school looks like the real one', () => {
  const data = SMPractice.make(), rows = data.tabs['Students'].slice(1);
  const fall = rows.filter(r => r[6] === 'Fall'), winter = rows.filter(r => r[6] === 'Winter');
  assert.ok(fall.length >= 340 && fall.length <= 360, 'about 350 students');
  assert.equal(winter.length, 40);
  assert.ok(rows.every(r => r[5] === '2026 - 2027'));
  const yog = {};
  fall.forEach(r => { yog[r[4]] = (yog[r[4]] || 0) + 1; });
  assert.deepEqual(Object.keys(yog).sort(), ['2027', '2028', '2029', '2030']);
  Object.values(yog).forEach(n => assert.ok(n >= 60 && n <= 100));
  assert.ok(rows.every(r => r[1] !== ''), 'Nickname is never blank');
  const differs = fall.filter(r => r[1] !== r[0]).length / fall.length;
  assert.ok(differs > 0.25 && differs < 0.42, 'about a third have a nickname');
  const boarders = fall.filter(r => r[10] === 'B').length / fall.length;
  assert.ok(boarders > 0.8 && boarders < 0.92);
  const genders = new Set(fall.map(r => r[9]));
  assert.ok(genders.has('Female') && genders.has('Male') && genders.has(''));
  const adv = {};
  fall.forEach(r => { adv[r[8]] = (adv[r[8]] || 0) + 1; });
  assert.equal(Object.keys(adv).length, 51);
  Object.entries(adv).forEach(([label, n]) => { assert.ok(n >= 4 && n <= 12, label + ' ' + n); assert.ok(label.split(' ').length <= 4); });
  const teams = new Set(fall.map(r => r[7]));
  assert.equal(teams.size, 21);
  assert.ok(rows.filter(r => r[3]).every(r => /@example\.org$/.test(r[3])));
  assert.equal(data.tabs['Faculty list'].length - 1, 92);
  assert.ok(data.tabs['Faculty list'].slice(1).every(r => /@example\.org$/.test(r[1])));
});

test('every planted case is there', () => {
  const { tabs, data } = practiceTabs();
  const p = data.planted, model = SMRead.readWorkbook(tabs), needs = model.needs.map(n => n.problem).join('\n');
  assert.equal(data.tabs['Not attending'].length - 1, 25);
  assert.match(needs, /has no email, so history can't follow/);
  assert.match(needs, /has the same email as row/);
  const answers = data.tabs['Faculty'].slice(1);
  assert.equal(p.facultySayNo.length, 8);
  p.facultySayNo.forEach(e => assert.equal(model.adults.find(a => a.email === e).attending, false));
  assert.equal(p.facultyNoAnswer.length, 6);
  p.facultyNoAnswer.forEach(e => assert.ok(!answers.some(r => r[1] === e)));
  assert.equal(p.couples.length, 3);
  p.couples.forEach(([a, b]) => assert.ok(model.adults.find(x => x.email === a).householdIds.includes(b)));
  assert.equal(p.guestHosts.length, 4);
  assert.ok(p.guestHosts.every(e => model.adults.find(a => a.email === e).guestSeats >= 1));
  assert.match(needs, /Named 2 guests but asked for 1 seat/);
  assert.equal(model.adults.filter(a => a.isNew).length, 4);
  assert.equal(model.adults.filter(a => a.isMentor).length, 6);
  p.triangle.forEach(e => assert.equal(model.adults.find(a => a.email === e).colleagueIds.length, 2));
  assert.match(needs, /Colleague "Morgan Notonlist" doesn't match anyone/);
  assert.match(needs, /Answered the faculty form twice/);
  assert.ok(tabs['Seating history'].length > 300, 'one past dinner is in history');
  const past = tabs['Past event'].slice(1).map(r => r[0]);
  assert.ok(past.includes('Quinn Nobodyhere'));
  assert.ok(past.some(n => /,/.test(n)), 'some names are last, first');
  assert.ok(past.some(n => /^[A-Z]\. /.test(n)), 'some names are an initial and a last name');
});
