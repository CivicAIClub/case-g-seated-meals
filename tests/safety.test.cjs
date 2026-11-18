'use strict';
// Safety: no network, mail, Drive, Docs, Forms or stored properties; no Node or browser globals or
// newer JavaScript in the Apps Script code; Sheets only in Main.gs; writes only in the write
// helpers; and no school emails or Google Docs links in any tracked file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const CORE = fs.readdirSync(path.join(root, 'core')).filter(f => f.endsWith('.js')).map(f => 'core/' + f);
const GS = fs.readdirSync(path.join(root, 'apps-script')).filter(f => f.endsWith('.gs')).map(f => 'apps-script/' + f);
const PASTE = 'paste-into-apps-script/SeatedMeals.gs';
const WRITE_HELPERS = ['writeTab_', 'createTabOnce_', 'appendRows_', 'rewriteHistory_', 'setEventValue_', 'writePracticeTabs_'];
const MAIN_START = 'Seated Meals: the Google Sheets side.';

// Blanks out comments but keeps strings, regex literals and line numbers, so findings name the
// right line.
function stripComments(src) {
  let out = '', i = 0, quote = null, prev = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === quote || (quote !== '`' && c === '\n')) quote = null;
      i++; continue;
    }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); const chunk = src.slice(i, end < 0 ? src.length : end + 2); out += chunk.replace(/[^\n]/g, ' '); i += chunk.length; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '/' && /[(,=:[!&|?{};]/.test(prev)) {
      // A regex literal: copy it through to its closing slash.
      let j = i + 1, inClass = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true; else if (src[j] === ']') inClass = false; else if (src[j] === '/' && !inClass) break;
        j++;
      }
      out += src.slice(i, j + 1); i = j + 1; prev = '/'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
function findings(rel, text, patterns) {
  const out = [];
  stripComments(text).split('\n').forEach((line, i) => patterns.forEach(([re, what]) => { if (re.test(line)) out.push(rel + ':' + (i + 1) + ' ' + what + ': ' + line.trim().slice(0, 120)); }));
  return out;
}

const BANNED = [
  [/\bUrlFetchApp\b/, 'UrlFetchApp'], [/\bMailApp\b/, 'MailApp'], [/\bGmailApp\b/, 'GmailApp'], [/\bDriveApp\b/, 'DriveApp'],
  [/\bDocumentApp\b/, 'DocumentApp'], [/\bFormApp\b/, 'FormApp'], [/\bPropertiesService\b/, 'PropertiesService'],
  [/https?:\/\//, 'a web address'], [/\bfetch\(/, 'fetch('],
  [/\brequire\(/, 'require('], [/\bmodule\.exports\b/, 'module.exports'], [/\bprocess\./, 'process'], [/\bBuffer\b/, 'Buffer'], [/\b__dirname\b/, '__dirname'],
  [/\bwindow\./, 'window'], [/\bdocument\./, 'document'], [/\bglobalThis\b/, 'globalThis'], [/\bsetTimeout\(/, 'setTimeout'], [/\bsetInterval\(/, 'setInterval'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bconsole\./, 'console'],
  [/\?\.[^\d]/, 'optional chaining (?.)'], [/\?\?/, '?? operator'], [/\bclass\s+\w+/, 'a class'], [/Object\.groupBy/, 'Object.groupBy'], [/\.toSorted\(/, '.toSorted('],
  [/\.findLast\(/, '.findLast('], [/\.at\(/, '.at('], [/\.replaceAll\(/, '.replaceAll('], [/\bstructuredClone\b/, 'structuredClone'],
  [/\bMath\.random\b/, 'Math.random'], [/\bDate\.now\b/, 'Date.now'], [/\binstanceof\s+Date\b/, 'instanceof Date'],
  [/\bTODO\b|\bFIXME\b/, 'a TODO or FIXME']
];
const WRITES = /\.(setValues?|appendRow|clear|clearContents|clearFormats|deleteRows?|insertSheet|deleteSheet)\(/;

test('the Apps Script code uses no network, mail, Drive, Docs, Forms, globals or newer JavaScript', () => {
  const all = [];
  for (const rel of CORE.concat(GS, [PASTE])) all.push(...findings(rel, read(rel), BANNED));
  assert.deepEqual(all, []);
});

test('only Main.gs touches SpreadsheetApp or the clock', () => {
  const all = [];
  for (const rel of CORE.concat(GS.filter(f => !f.endsWith('Main.gs')))) all.push(...findings(rel, read(rel), [[/\bSpreadsheetApp\b/, 'SpreadsheetApp'], [/\bnew Date\(\s*\)/, 'the clock'], [/\b(Session|Utilities|LockService)\./, 'an Apps Script service']]));
  const paste = read(PASTE), start = paste.indexOf(MAIN_START);
  assert.ok(start > 0, 'the paste file contains Main.gs');
  all.push(...findings(PASTE + ' (before Main.gs)', paste.slice(0, start), [[/\bSpreadsheetApp\b/, 'SpreadsheetApp']]));
  assert.deepEqual(all, []);
});

test('every write is inside a write helper', () => {
  const all = [];
  for (const rel of CORE.concat(GS.filter(f => !f.endsWith('Main.gs')))) all.push(...findings(rel, read(rel), [[WRITES, 'a write method']]));
  const paste = read(PASTE);
  all.push(...findings(PASTE + ' (before Main.gs)', paste.slice(0, paste.indexOf(MAIN_START)), [[WRITES, 'a write method']]));
  for (const [rel, text] of [['apps-script/Main.gs', read('apps-script/Main.gs')], [PASTE + ' (Main.gs part)', paste.slice(paste.indexOf(MAIN_START))]]) {
    let current = '';
    stripComments(text).split('\n').forEach((line, i) => {
      const m = line.match(/^function (\w+)\(/);
      if (m) current = m[1];
      else if (/^\S/.test(line) && !/^}/.test(line)) current = '';
      if (WRITES.test(line) && WRITE_HELPERS.indexOf(current) < 0) all.push(rel + ':' + (i + 1) + ' write outside the write helpers (in ' + (current || 'top level') + '): ' + line.trim());
    });
  }
  assert.deepEqual(all, []);
  assert.ok(WRITE_HELPERS.every(h => new RegExp('^function ' + h + '\\(', 'm').test(read('apps-script/Main.gs'))), 'every write helper exists');
});

test('no tracked file has a school email address or a Google Docs or Sheets link', () => {
  let tracked;
  try { tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean); }
  catch (e) { tracked = []; }
  assert.ok(tracked.length > 10, 'git ls-files lists the repo');
  const domain = new RegExp('@' + 'pomfret\\.org', 'i'), docs = new RegExp('docs\\.' + 'google\\.com', 'i');
  const bad = [];
  for (const rel of tracked) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (domain.test(text)) bad.push(rel + ': school email domain');
    if (docs.test(text)) bad.push(rel + ': Google Docs or Sheets link');
  }
  assert.deepEqual(bad, []);
});

test('the comment stripper keeps code and drops comments', () => {
  assert.equal(stripComments('a // UrlFetchApp\nb /* MailApp */ c').replace(/\s+/g, ' ').trim(), 'a b c');
  assert.match(stripComments("var s = 'http://x'; // y"), /http:\/\/x/);
  assert.match(stripComments('var r = /a\\/\\/b/; // z'), /a\\\/\\\/b/);
});
