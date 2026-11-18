/** @OnlyCurrentDoc */
/*
 * Seated Meals: the Google Sheets side.
 *
 * The menu, what each menu item does, reading the tabs and every write. This is the only file
 * that touches SpreadsheetApp. The seating itself is in the core files (SMRead, SMHistory, SMSeat,
 * SMOutput, SMPractice), which never call Sheets.
 *
 * Every write goes through the helpers near the bottom, and each one throws on a tab it isn't for,
 * so the program can never write to the tabs people fill in (Students, Faculty, Faculty list,
 * Past event). Only Make practice data writes those, through its own helper.
 */

var SM_SETUP_TABS = ['Event', 'Rules', 'Tables', 'Not attending', 'Locked seats', 'Seating history', 'Waiter history'];
var SM_HISTORY_TABS = ['Seating history', 'Waiter history'];
var SM_APPEND_TABS = ['Seating history', 'Waiter history', 'SM Run log'];
var SM_PRACTICE_TABS = ['Students', 'Faculty', 'Faculty list', 'Not attending', 'Past event'];
var SM_READ_TABS = ['Event', 'Rules', 'Tables', 'Students', 'Faculty', 'Faculty list', 'Not attending', 'Locked seats', 'Seating history', 'Waiter history', 'SM Seating', 'Past event'];

// ---------- Menu ----------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Seated Meals')
    .addItem('Sort', 'SM_sort')
    .addItem('Sort again with a new shuffle', 'SM_sortAgain')
    .addItem('Check again', 'SM_checkAgain')
    .addSeparator()
    .addItem('Save this event to history', 'SM_saveToHistory')
    .addItem('Add a past event to history', 'SM_addPastEvent')
    .addSeparator()
    .addItem('Make practice data', 'SM_makePracticeData')
    .addToUi();
}

function SM_sort() { smRun_(function () { return smSort_(false); }); }
function SM_sortAgain() { smRun_(function () { return smSort_(true); }); }
function SM_checkAgain() { smRun_(smCheckAgain_); }
function SM_saveToHistory() { smRun_(smSaveToHistory_); }
function SM_addPastEvent() { smRun_(smAddPastEvent_); }
function SM_makePracticeData() { smRun_(smMakePracticeData_); }

// Runs one menu item and shows its finish message, or what stopped it and what to do next.
function smRun_(action) {
  var ui = SpreadsheetApp.getUi();
  try {
    var message = action();
    if (message) ui.alert('Seated Meals', message, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Seated Meals stopped', (e && e.message ? e.message : String(e)) + '\n\nFix the problem above, then run the menu item again.', ui.ButtonSet.OK);
  }
}

// ---------- Reading ----------

// Every tab the program reads, each with one getValues. A missing tab is null.
function smReadTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tabs = {};
  SM_READ_TABS.forEach(function (name) {
    var s = ss.getSheetByName(name);
    tabs[name] = s && s.getLastRow() > 0 ? s.getDataRange().getValues() : null;
  });
  return tabs;
}
// Creates any missing setup tab with its defaults. Existing tabs are never touched.
function smEnsureSetup_() {
  var defaults = SMRead.setupDefaults();
  SM_SETUP_TABS.forEach(function (name) { createTabOnce_(name, defaults[name]); });
}
function smHasData_(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s || s.getLastRow() === 0) return false;
  return s.getDataRange().getValues().some(function (row) { return row.some(function (v) { return String(v).trim() !== ''; }); });
}
function smAsk_(question, buttons) {
  var ui = SpreadsheetApp.getUi();
  return ui.alert('Seated Meals', question, buttons);
}
// Asks for a line of text. Returns null on Cancel.
function smPrompt_(title, question) {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt(title, question, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return String(r.getResponseText()).trim();
}
function smNow_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }

// ---------- Sort ----------

function smSort_(newShuffle) {
  var ui = SpreadsheetApp.getUi(), label = newShuffle ? 'Sort again' : 'Sort';
  smEnsureSetup_();
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SM Seating')) {
    var ok = smAsk_('This replaces SM Seating and the shared tabs, including changes made by hand. Rows in Locked seats stay put. Continue?', ui.ButtonSet.OK_CANCEL);
    if (ok !== ui.Button.OK) return label + ' cancelled. Nothing changed.';
  }
  var who = smPrompt_(label, 'Who is running this, and why? (goes in SM Run log)');
  if (who === null) return label + ' cancelled. Nothing changed.';
  if (who === '') return label + ' needs an answer to "Who is running this, and why?" for SM Run log. Nothing changed; run it again and type a short answer.';
  var tabs = smReadTabs_(), model = SMRead.readWorkbook(tabs);
  if (newShuffle) {
    model.event.seed = model.event.seed + 1;
    setEventValue_('Seed', model.event.seed);
  }
  var result = SMSeat.sort(model), out = SMOutput.allTabs(model, result, true);
  SMOutput.TAB_ORDER.forEach(function (name) { if (out[name]) writeTab_(name, out[name]); });
  appendRows_('SM Run log', [SMOutput.runLogRow(model, result, who, smNow_())]);
  return SMOutput.sortMessage(model, result);
}

// ---------- Check again ----------

function smCheckAgain_() {
  smEnsureSetup_();
  var tabs = smReadTabs_(), model = SMRead.readWorkbook(tabs), seating = SMRead.readSeating(tabs['SM Seating']);
  var result = SMSeat.checkAgain(model, seating), out = SMOutput.allTabs(model, result, false);
  SMOutput.TAB_ORDER.forEach(function (name) { if (out[name]) writeTab_(name, out[name]); });
  return SMOutput.checkMessage(result);
}

// ---------- History ----------

// Asks before replacing rows of an event already in history. Returns false if the person says no.
function smReplaceIfSaved_(eventName, date) {
  var ui = SpreadsheetApp.getUi(), tabs = smReadTabs_(), ev = SMRead.readEvent(tabs['Event']);
  var seats = SMRead.readSeatingHistory(tabs['Seating history'], ev), waits = SMRead.readWaiterHistory(tabs['Waiter history'], ev);
  if (!SMHistory.hasEvent(seats, eventName, date) && !SMHistory.hasEvent(waits, eventName, date)) return true;
  var answer = smAsk_('History already has ' + eventName + ' on ' + date + '. Replace those rows with this list?', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return false;
  rewriteHistory_('Seating history', SMHistory.withoutEvent('Seating history', tabs['Seating history'], eventName, date));
  rewriteHistory_('Waiter history', SMHistory.withoutEvent('Waiter history', tabs['Waiter history'], eventName, date));
  return true;
}

function smSaveToHistory_() {
  smEnsureSetup_();
  var tabs = smReadTabs_(), ev = SMRead.readEvent(tabs['Event']), seating = SMRead.readSeating(tabs['SM Seating']);
  var rows = SMHistory.rowsToSave(seating, ev.name, ev.date);
  if (!smReplaceIfSaved_(ev.name, ev.date)) return 'Nothing saved. History still has the earlier rows for ' + ev.name + ' on ' + ev.date + '.';
  if (rows.seats.length) appendRows_('Seating history', rows.seats);
  if (rows.waiters.length) appendRows_('Waiter history', rows.waiters);
  return 'Saved ' + rows.seats.length + ' seats and ' + rows.waiters.length + ' waiters to history. The next Sort will use them.';
}

function smAddPastEvent_() {
  smEnsureSetup_();
  var tabs = smReadTabs_();
  if (!tabs['Past event']) throw new Error('There is no Past event tab. Paste one past seating list into a tab named Past event, with at least a Name and a Table column.');
  var name = smPrompt_('Add a past event to history', 'What was the event called? (for example: Candlelight 2025)');
  if (name === null || name === '') return 'Nothing added. Run it again and type the event\'s name.';
  var dateText = smPrompt_('Add a past event to history', 'What was its date? (YYYY-MM-DD, for example 2025-12-16)');
  if (dateText === null) return 'Nothing added.';
  var date = SMRead.dateKey(dateText);
  if (!date) return 'Nothing added: "' + dateText + '" is not a date like 2025-12-16. Run it again.';
  var model = SMRead.readWorkbook(tabs), past = SMRead.readPastEvent(tabs['Past event'], model.event);
  var res = SMHistory.matchPastEvent(past, model.students, model.adults);
  var rows = SMHistory.pastRows(res.matched, name, date);
  if (!smReplaceIfSaved_(name, date)) return 'Nothing added. History still has the earlier rows for ' + name + ' on ' + date + '.';
  if (rows.seats.length) appendRows_('Seating history', rows.seats);
  if (rows.waiters.length) appendRows_('Waiter history', rows.waiters);
  writeTab_('SM Needs you', SMOutput.needsTab(res.needs));
  return 'Matched ' + res.matched.length + ' of ' + past.length + ' rows and added them to history as ' + name + ' on ' + date + '. ' +
    (res.needs.length ? res.needs.length + ' rows need a person: see SM Needs you. Type the right email into those Past event rows and run this again (it asks before replacing).' : 'Every row matched.');
}

// ---------- Practice data ----------

function smMakePracticeData_() {
  var data = SMPractice.make();
  writePracticeTabs_(data);
  smEnsureSetup_();
  var tabs = smReadTabs_(), ev = SMRead.readEvent(tabs['Event']);
  if (!SMRead.readSeatingHistory(tabs['Seating history'], ev).length && !SMRead.readWaiterHistory(tabs['Waiter history'], ev).length) {
    appendRows_('Seating history', data.history['Seating history'].slice(1));
    appendRows_('Waiter history', data.history['Waiter history'].slice(1));
  }
  setEventValue_('Season', data.event.Season);
  return 'Made practice data: about 350 invented students, the faculty form\'s answers, a Faculty list, absences, and one past dinner in history.\n\n' +
    'Next: Seated Meals > Add a past event to history, with the name ' + data.pastEvent.name + ' and the date ' + data.pastEvent.date + '. Then Sort.';
}

// ---------- Write helpers (the only code that writes) ----------

// Rewrites one SM tab (never SM Run log): clears values and formats, writes the rows in one
// setValues, bolds the header and any section rows, and freezes the header.
function writeTab_(name, tab) {
  if (String(name).indexOf('SM ') !== 0 || name === 'SM Run log') throw new Error('writeTab_ only writes SM tabs other than SM Run log, not "' + name + '".');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name) || ss.insertSheet(name);
  var grid = SMOutput.grid(tab.rows);
  s.clearContents();
  s.clearFormats();
  if (grid.length) s.getRange(1, 1, grid.length, grid[0].length).setValues(grid);
  var bold = (tab.bold || []).map(function (r) { return 'A' + r + ':' + SMOutput.columnLetter(grid[0].length) + r; });
  if (bold.length) s.getRangeList(bold).setFontWeight('bold');
  s.setFrozenRows(tab.freeze || 1);
}

// Creates a setup tab with its default rows. Does nothing if the tab exists.
function createTabOnce_(name, rows) {
  if (SM_SETUP_TABS.indexOf(name) < 0) throw new Error('createTabOnce_ only creates setup tabs, not "' + name + '".');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(name)) return false;
  var s = ss.insertSheet(name), grid = SMOutput.grid(rows);
  s.getRange(1, 1, grid.length, grid[0].length).setValues(grid);
  s.getRangeList(['A1:' + SMOutput.columnLetter(grid[0].length) + '1']).setFontWeight('bold');
  s.setFrozenRows(1);
  return true;
}

// Adds rows at the bottom of a history tab or SM Run log. Creates the tab with its header if missing.
function appendRows_(name, rows) {
  if (SM_APPEND_TABS.indexOf(name) < 0) throw new Error('appendRows_ only adds to Seating history, Waiter history and SM Run log, not "' + name + '".');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    var header = name === 'SM Run log' ? SMOutput.RUN_LOG_HEADERS : SMRead.setupDefaults()[name][0];
    s.getRange(1, 1, 1, header.length).setValues([header]);
    s.getRangeList(['A1:' + SMOutput.columnLetter(header.length) + '1']).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  if (!rows.length) return;
  var grid = SMOutput.grid(rows);
  s.getRange(s.getLastRow() + 1, 1, grid.length, grid[0].length).setValues(grid);
}

// Rewrites a history tab after the person agreed to replace one event's rows. This is the only
// time history rows are removed.
function rewriteHistory_(name, rows) {
  if (SM_HISTORY_TABS.indexOf(name) < 0) throw new Error('rewriteHistory_ only rewrites Seating history and Waiter history, not "' + name + '".');
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('There is no ' + name + ' tab.');
  var grid = SMOutput.grid(rows);
  s.clearContents();
  if (grid.length) s.getRange(1, 1, grid.length, grid[0].length).setValues(grid);
}

// Sets one value in the Event tab (Seed for Sort again, Season for practice data). Adds the row if missing.
function setEventValue_(key, value) {
  if (key !== 'Seed' && key !== 'Season') throw new Error('setEventValue_ only sets Seed or Season, not "' + key + '".');
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Event');
  if (!s) throw new Error('There is no Event tab.');
  var values = s.getDataRange().getValues(), c = SMRead.columnsOf('Event', values, null);
  for (var i = 1; i < values.length; i++) {
    if (SMRead.norm(values[i][c.idx.Key]) === SMRead.norm(key)) { s.getRange(i + 1, c.idx.Value + 1).setValue(SMOutput.safeCell(value)); return; }
  }
  s.getRange(values.length + 1, 1, 1, 3).setValues([[key, SMOutput.safeCell(value), '']]);
}

// Make practice data's own writer. Refuses unless Students and Faculty are empty, so it can never
// overwrite real data.
function writePracticeTabs_(data) {
  if (smHasData_('Students') || smHasData_('Faculty')) throw new Error('Make practice data only runs in a spreadsheet whose Students and Faculty tabs are empty. Make a new blank spreadsheet for practice.');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  SM_PRACTICE_TABS.forEach(function (name) {
    var s = ss.getSheetByName(name) || ss.insertSheet(name), grid = SMOutput.grid(data.tabs[name]);
    s.clearContents();
    s.clearFormats();
    s.getRange(1, 1, grid.length, grid[0].length).setValues(grid);
    s.getRangeList(['A1:' + SMOutput.columnLetter(grid[0].length) + '1']).setFontWeight('bold');
    s.setFrozenRows(1);
  });
}
