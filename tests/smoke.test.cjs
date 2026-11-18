'use strict';
// A first check that the project is set up: the spec is in place and the fake spreadsheet works
// the way the other tests expect.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Sheet, asSheets } = require('./helpers/fake-spreadsheet.cjs');

const root = path.join(__dirname, '..');

test('the spec and the decisions file are in place', () => {
  const spec = fs.readFileSync(path.join(root, 'docs', 'spec.md'), 'utf8');
  assert.match(spec, /^This text is the build spec for Case G/);
  assert.match(spec, /# Done checklist/);
  assert.ok(fs.existsSync(path.join(root, 'docs', 'decisions.md')));
});

test('the package has no dependencies and runs on Node 22 or newer', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  assert.equal(Object.keys(pkg.devDependencies || {}).length, 0);
  assert.equal(pkg.engines.node, '>=22');
});

test('the fake spreadsheet stores values the way Sheets does', () => {
  const s = new Sheet('Example');
  s.getRange(1, 1, 1, 4).setValues([['12', '2026-12-15', "'=1+1", 'Text']]);
  const [row] = s.getDataRange().getValues();
  assert.equal(row[0], 12);
  assert.equal(Object.prototype.toString.call(row[1]), '[object Date]');
  assert.equal(row[2], '=1+1');
  assert.equal(row[3], 'Text');
  assert.equal(asSheets('Yes'), 'Yes');
  assert.equal(s.getLastRow(), 1);
});
