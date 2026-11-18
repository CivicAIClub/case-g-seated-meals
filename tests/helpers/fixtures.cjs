'use strict';
// Small made-up workbooks for the tests, plus the full practice workbook. Every name is invented
// and every email ends in @example.org.
const { loadCore } = require('./core.cjs');

const core = loadCore();
const { SMRead, SMPractice } = core;
const STUDENT_HEADERS = ['FirstName', 'Nickname', 'LastName', 'Email', 'YOG', 'SchoolYear', 'TeamSeason', 'TeanName', 'AdvisorGroup', 'Gender', 'BoardingDay'];
const FACULTY_HEADERS = ['Timestamp', 'Email Address', 'Your name', 'Will you attend this seated meal?', 'Will a spouse, partner or child join you? If so, who?',
  'How many seats should we save for your guests?', "Up to three colleagues you'd enjoy sitting with", 'Are you new to Pomfret this year, or would you be glad to sit with a colleague who is?'];

// One student row in the export's layout. o can set nickname, email, yog, season, team, advisory, gender, bd.
function student(first, last, o = {}) {
  return [first, o.nick || first, last, o.email === undefined ? (first + '.' + last).toLowerCase() + '@example.org' : o.email, String(o.yog || 2027),
    o.year === undefined ? '2026 - 2027' : o.year, o.season || 'Fall', o.team || 'Soccer - Blue', o.advisory || 'Birch', o.gender || 'Female', o.bd || 'B'];
}
// One faculty form answer. o can set attend, guests, seats, colleagues, newText, time.
function answer(name, o = {}) {
  const email = o.email || name.toLowerCase().replace(/\s+/g, '.') + '@example.org';
  return [o.time || '11/05/2026 9:00:00', email, name, o.attend || 'Yes', o.guests || '', o.seats === undefined ? '' : String(o.seats), o.colleagues || '', o.newText || 'Neither'];
}
function setEvent(rows, key, value) {
  const r = rows.find(x => String(x[0]).toLowerCase() === key.toLowerCase());
  if (r) r[1] = value; else rows.push([key, value, '']);
}
// A workbook as the tabs map readWorkbook takes. Tables: count (all in row A unless rows given),
// or explicit rows. rules: { id: { on, value, rank } }.
function workbook(o = {}) {
  const d = SMRead.setupDefaults(), tabs = {};
  tabs['Event'] = d['Event'].map(r => r.slice());
  for (const [k, v] of Object.entries(o.event || {})) setEvent(tabs['Event'], k, v);
  if (o.tables) tabs['Tables'] = [['Table', 'Row', 'In use', 'Seats']].concat(o.tables);
  else if (o.tableCount) tabs['Tables'] = [['Table', 'Row', 'In use', 'Seats']].concat(Array.from({ length: o.tableCount }, (_, i) => [i + 1, 'A', 'Yes', o.seats || '']));
  else tabs['Tables'] = d['Tables'].map(r => r.slice());
  tabs['Rules'] = d['Rules'].map(r => r.slice());
  for (const [id, change] of Object.entries(o.rules || {})) {
    const r = tabs['Rules'].find(x => SMRead.ruleId(x[1]) === id);
    if (change.on !== undefined) r[2] = change.on ? 'Yes' : 'No';
    if (change.value !== undefined) r[3] = change.value;
    if (change.rank !== undefined) r[0] = change.rank;
  }
  tabs['Students'] = [STUDENT_HEADERS.slice()].concat(o.students || []);
  tabs['Faculty'] = o.faculty ? [FACULTY_HEADERS.slice()].concat(o.faculty) : null;
  tabs['Faculty list'] = o.list ? [['Name', 'Email', 'AdvisorGroup']].concat(o.list) : null;
  tabs['Not attending'] = [['Email', 'Name', 'Why']].concat(o.notAttending || []);
  tabs['Locked seats'] = [['Email', 'Name', 'Table', 'Why']].concat(o.locks || []);
  tabs['Seating history'] = [['Event', 'Date', 'Email', 'Name', 'Table']].concat(o.seatingHistory || []);
  tabs['Waiter history'] = [['Event', 'Date', 'Email', 'Name', 'Role']].concat(o.waiterHistory || []);
  return tabs;
}
// The practice workbook after Make practice data (and, with withPast, after adding Practice dinner B).
function practiceTabs(o = {}) {
  const data = SMPractice.make(), d = SMRead.setupDefaults(), tabs = {};
  for (const [name, rows] of Object.entries(data.tabs)) tabs[name] = rows.map(r => r.slice());
  for (const name of ['Event', 'Rules', 'Tables', 'Locked seats']) tabs[name] = d[name].map(r => r.slice());
  setEvent(tabs['Event'], 'Season', data.event.Season);
  tabs['Seating history'] = data.history['Seating history'].map(r => r.slice());
  tabs['Waiter history'] = data.history['Waiter history'].map(r => r.slice());
  if (o.withPast) {
    const model = SMRead.readWorkbook(tabs), past = SMRead.readPastEvent(tabs['Past event'], model.event);
    const res = core.SMHistory.matchPastEvent(past, model.students, model.adults), rows = core.SMHistory.pastRows(res.matched, data.pastEvent.name, data.pastEvent.date);
    tabs['Seating history'] = tabs['Seating history'].concat(rows.seats);
    tabs['Waiter history'] = tabs['Waiter history'].concat(rows.waiters);
  }
  for (const [k, v] of Object.entries(o.event || {})) setEvent(tabs['Event'], k, v);
  for (const [id, change] of Object.entries(o.rules || {})) {
    const r = tabs['Rules'].find(x => SMRead.ruleId(x[1]) === id);
    if (change.on !== undefined) r[2] = change.on ? 'Yes' : 'No';
    if (change.value !== undefined) r[3] = change.value;
  }
  return { tabs, data };
}
// Table of each person's id, from a sort result.
function tableOf(result) {
  const out = {};
  for (const r of result.rows) if (r.person) out[r.person.id] = r.table;
  return out;
}

module.exports = { core, STUDENT_HEADERS, FACULTY_HEADERS, student, answer, workbook, practiceTabs, setEvent, tableOf };
