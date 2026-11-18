'use strict';
// npm run demo: the whole flow on practice data, against the fake spreadsheet, using the paste
// file exactly as Apps Script would run it. Make practice data, Add a past event to history, Sort,
// Check again, Save this event to history. Every SM tab is written as CSV into demo-output/
// (gitignored), and SM Check is printed. Made-up people only.
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('./build-apps-script.cjs');
const { loadBundle } = require('../tests/helpers/fake-spreadsheet.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'demo-output');

function csvCell(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') v = v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function run() {
  build();
  const b = loadBundle(), say = [];
  function step(label, fn, answers) {
    b.ui.answers.push(...(answers || []));
    fn();
    const msg = b.ui.lastMessage();
    say.push('== ' + label + '\n' + msg);
    if (/^Seated Meals stopped/.test(b.ui.shown[b.ui.shown.length - 1].title || '')) throw new Error(label + ' stopped: ' + msg);
  }
  step('Make practice data', () => b.context.SM_makePracticeData());
  step('Add a past event to history', () => b.context.SM_addPastEvent(), [{ text: 'Practice dinner B' }, { text: '2026-11-10' }]);
  step('Sort', () => b.context.SM_sort(), [{ text: 'Demo run on practice data' }]);
  step('Check again', () => b.context.SM_checkAgain());
  step('Save this event to history', () => b.context.SM_saveToHistory());

  fs.mkdirSync(outDir, { recursive: true });
  for (const s of b.spreadsheet.getSheets()) {
    if (!s.getName().startsWith('SM ')) continue;
    const csv = s.rows().map(r => r.map(csvCell).join(',')).join('\n') + '\n';
    fs.writeFileSync(path.join(outDir, s.getName().replace(/^SM /, '').replace(/\s+/g, '-').toLowerCase() + '.csv'), csv);
  }
  console.log(say.join('\n\n'));
  console.log('\n== SM Check');
  for (const r of b.sheet('SM Check').rows()) console.log(r[1] ? r[0] + ' | ' + r[1] + ' | ' + r[2] : r[0]);
  console.log('\nEvery SM tab is in demo-output/ as CSV.');
}

run();
