'use strict';
// A small stand-in for Google Sheets, adapted from case-f-project-pomfret's helper. It keeps only
// what Main.gs uses. Like Sheets, setValues turns typed text into numbers and dates, and a leading
// apostrophe keeps text as text (the apostrophe itself is not stored). Like Sheets, a new tab has
// 1,000 rows and 26 columns, and a range past them throws until rows or columns are inserted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');

// What Sheets does to a value typed into a cell.
function asSheets(v) {
  if (typeof v !== 'string') return v;
  if (v.charAt(0) === "'") return v.slice(1);
  if (/^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return v;
}
function column(letters) { return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0); }

class Range {
  constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, { sheet, row, col, rows, cols }); }
  getValues() {
    return Array.from({ length: this.rows }, (_, i) => Array.from({ length: this.cols }, (_, j) => {
      const r = this.sheet.data[this.row + i - 1];
      const v = r ? r[this.col + j - 1] : undefined;
      return v === undefined ? '' : v;
    }));
  }
  setValues(values) {
    if (values.length !== this.rows || values.some(r => r.length !== this.cols)) throw new Error('setValues: the data does not match the range size');
    this.sheet.writes++;
    values.forEach((row, i) => row.forEach((v, j) => {
      const r = this.row + i - 1;
      if (!this.sheet.data[r]) this.sheet.data[r] = [];
      this.sheet.data[r][this.col + j - 1] = asSheets(v);
      this.sheet.raw.set((r + 1) + ',' + (this.col + j), v);
    }));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setFontWeight(w) {
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < this.cols; j++) {
      const key = (this.row + i) + ',' + (this.col + j);
      if (w === 'bold') this.sheet.bold.add(key); else this.sheet.bold.delete(key);
    }
    return this;
  }
}
class RangeList {
  constructor(ranges) { this.ranges = ranges; }
  setFontWeight(w) { this.ranges.forEach(r => r.setFontWeight(w)); return this; }
}
class Sheet {
  constructor(name, data = []) {
    Object.assign(this, { name, data: data.map(r => r.slice()), bold: new Set(), raw: new Map(), frozen: 0, writes: 0 });
    this.maxRows = Math.max(1000, this.data.length);
    this.maxCols = Math.max(26, ...this.data.map(r => (r || []).length));
  }
  getName() { return this.name; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(after, n) {
    if (after < this.data.length) this.data.splice(after, 0, ...Array.from({ length: n }, () => []));
    this.maxRows += n;
    return this;
  }
  insertColumnsAfter(after, n) {
    this.data.forEach(r => { if (r && r.length > after) r.splice(after, 0, ...Array(n).fill(undefined)); });
    this.maxCols += n;
    return this;
  }
  // Real Sheets refuses a range outside the tab's rows and columns.
  checkRange(row, col, rows, cols) {
    if (row < 1 || col < 1) throw new Error('The starting row or column of the range is too small.');
    if (row + rows - 1 > this.maxRows || col + cols - 1 > this.maxCols) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
  }
  getLastRow() {
    for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some(v => v !== '' && v !== undefined)) return i;
    return 0;
  }
  getLastColumn() { return Math.max(0, ...this.data.map(r => (r || []).length)); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(row, col, rows = 1, cols = 1) { this.checkRange(row, col, rows, cols); return new Range(this, row, col, rows, cols); }
  getRangeList(a1s) {
    return new RangeList(a1s.map(a1 => {
      const [, c1, r1, c2, r2] = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      const row = Number(r1), col = column(c1), rows = Number(r2 || r1) - row + 1, cols = column(c2 || c1) - col + 1;
      this.checkRange(row, col, rows, cols);
      return new Range(this, row, col, rows, cols);
    }));
  }
  clearContents() { this.data = []; this.raw.clear(); return this; }
  clearFormats() { this.bold.clear(); return this; }
  setFrozenRows(n) { this.frozen = n; }
  getFrozenRows() { return this.frozen; }
  isBold(row, col = 1) { return this.bold.has(row + ',' + col); }
  // The values as the tests read them: trailing empty rows dropped.
  rows() { return this.getDataRange().getValues().slice(0, this.getLastRow()); }
}
function spreadsheetFor(sheets) {
  return {
    getSheetByName: name => sheets.get(name) || null,
    insertSheet: name => {
      if (sheets.has(name)) throw new Error('A sheet named "' + name + '" already exists');
      const s = new Sheet(name); sheets.set(name, s); return s;
    },
    getSheets: () => [...sheets.values()]
  };
}
// A fake SpreadsheetApp.getUi(). Answers are queued by the test: 'OK', 'CANCEL', 'YES', 'NO' for
// alerts with buttons, and { button, text } for prompts. Every message shown is kept in ui.shown.
function fakeUi() {
  const Button = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' };
  const ui = {
    Button, ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    answers: [], shown: [], menus: [],
    alert(title, message, buttons) {
      if (message === undefined) { message = title; title = ''; }
      ui.shown.push({ kind: 'alert', title, message, buttons });
      if (!buttons || buttons === 'OK') return Button.OK;
      if (!ui.answers.length) throw new Error('The test gave no answer for: ' + title + ' ' + message);
      return ui.answers.shift();
    },
    prompt(title, message, buttons) {
      ui.shown.push({ kind: 'prompt', title, message, buttons });
      if (!ui.answers.length) throw new Error('The test gave no answer for the prompt: ' + title);
      const a = ui.answers.shift();
      return { getSelectedButton: () => a.button || Button.OK, getResponseText: () => a.text || '' };
    },
    createMenu(name) {
      const menu = { name, items: [], addItem(label, fn) { menu.items.push([label, fn]); return menu; }, addSeparator() { return menu; }, addToUi() { ui.menus.push(menu); } };
      return menu;
    },
    lastMessage() { const a = ui.shown.filter(s => s.kind === 'alert'); return a.length ? a[a.length - 1].message : ''; }
  };
  return ui;
}
// Loads the generated paste file into a sandbox with the fake spreadsheet, the way Apps Script
// runs it: one global scope. Returns the sheets, the fake UI and the sandbox (its globals are the
// menu handlers and helpers).
function loadBundle(start = {}) {
  const sheets = new Map(Object.entries(start).map(([name, rows]) => [name, new Sheet(name, rows)]));
  const spreadsheet = spreadsheetFor(sheets), ui = fakeUi();
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ui },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    Utilities: { formatDate: () => '2026-12-01 09:00' }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'paste-into-apps-script', 'SeatedMeals.gs'), 'utf8'), context);
  return { sheets, spreadsheet, ui, context, sheet: name => sheets.get(name) };
}
module.exports = { Sheet, Range, asSheets, spreadsheetFor, fakeUi, loadBundle };
