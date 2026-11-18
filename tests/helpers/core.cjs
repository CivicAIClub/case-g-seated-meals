'use strict';
// Loads every core/ file into one sandbox, the way Apps Script loads its .gs files into one global
// scope, and returns that scope. Core files never use require or module, so the tests run exactly
// the code that goes into the paste file.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CORE_FILES = ['read.js', 'history.js', 'seat.js', 'output.js', 'practice.js'];
const coreDir = path.join(__dirname, '..', '..', 'core');

function loadCore() {
  const context = vm.createContext({});
  for (const file of CORE_FILES) {
    const p = path.join(coreDir, file);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), context, { filename: p });
  }
  return context;
}
// Values that cross the sandbox boundary have the sandbox's own Array and Object, which
// assert.deepStrictEqual treats as different. plain() turns them into this realm's values.
function plain(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

module.exports = { loadCore, plain, CORE_FILES };
