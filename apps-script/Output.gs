// Generated from core/output.js by npm run bundle. Edit core/output.js, then rebuild.
/*
 * Seated Meals: the rows for every SM tab.
 *
 * Builds plain arrays of rows (plus which rows are bold and how many to freeze) for SM Seating,
 * the four shared tabs, SM Check, SM Needs you and the SM Run log row, and the finish messages.
 * Main.gs writes them. The shared tabs carry only names, form, table, role and guests.
 */
var SMOutput = (function () {
  'use strict';

  var SEATING_NOTE = 'Edit the Table or Role column here, then run Check again. Sort again replaces this tab; to keep a seat, add it to Locked seats.';
  var SEATING_HEADERS = ['Table', 'Name', 'Kind', 'Form', 'Role', 'Email', 'Locked', 'Why'];
  // The four tabs that get shared with the whole school, and the only columns they may have.
  var SHARED_HEADERS = {
    'SM By first name': ['First', 'Last', 'Form', 'Table', 'Role'],
    'SM By form': ['Form', 'Last', 'First', 'Table', 'Role'],
    'SM By table': ['Name', 'Form', 'Role'],
    'SM Faculty': ['Name', 'Table', 'Guests']
  };
  var CHECK_HEADERS = ['Rule', 'Result', 'Details'];
  var NEEDS_HEADERS = ['Section', 'Name', 'Email', 'Problem'];
  var NEEDS_ORDER = ['Data problems', 'Past event', 'Lock problems', 'Could not seat', 'Tables without an adult'];
  var RUN_LOG_HEADERS = ['Time', 'Who and why', 'Event', 'Date', 'Sort', 'Seed', 'Rules as used', 'Students', 'Faculty', 'Tables', 'Rules not fully met'];
  var TAB_ORDER = ['SM Seating', 'SM By first name', 'SM By form', 'SM By table', 'SM Faculty', 'SM Check', 'SM Needs you'];
  var SHORT = { forms: 'forms', perForm: 'per form', tablemates: 'no repeat tablemates', waited: 'a waiter before', neighbors: 'neighbors',
    gender: 'gender mixed', boarding: 'boarding and day mixed', sameStudents: 'new table (students)', sameFaculty: 'new table (faculty)' };

  // Text that starts with =, +, - or @ gets a leading apostrophe, so Sheets never reads it as a formula.
  function safeCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean' || Object.prototype.toString.call(v) === '[object Date]') return v;
    var s = String(v);
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }
  // Rows padded to one width (setValues needs a rectangle), every cell made safe.
  function grid(rows) {
    var width = 1;
    rows.forEach(function (r) { if (r.length > width) width = r.length; });
    return rows.map(function (r) {
      var out = [];
      for (var i = 0; i < width; i++) out.push(safeCell(r[i]));
      return out;
    });
  }
  function columnLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s || 'A'; }
  function low(v) { return String(v || '').toLowerCase(); }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function tableOrder(a, b) {
    var x = isNaN(a.table) ? Infinity : a.table, y = isNaN(b.table) ? Infinity : b.table;
    return x - y || (x === Infinity ? cmp(a.tableText, b.tableText) : 0);
  }

  // First and last name for a row, from the person when known, otherwise from the typed name.
  function parts(r) {
    if (r.person) return { first: r.person.shownFirst, last: r.person.last };
    var w = String(r.name).split(/\s+/);
    return { first: w.slice(0, -1).join(' ') || w[0], last: w.length > 1 ? w[w.length - 1] : '' };
  }
  function kindOf(r) { return low(r.kind); }
  function isStudent(r) { return kindOf(r) !== 'faculty' && kindOf(r) !== 'guest'; }

  // SM Seating order: by table, then adults (each faculty member followed by their guests), then
  // students, by name.
  function seatingOrder(rows) {
    function adultName(r) { return low(kindOf(r) === 'guest' && r.host ? r.host.name : r.name); }
    return rows.slice().sort(function (a, b) {
      return tableOrder(a, b) || (isStudent(a) ? 1 : 0) - (isStudent(b) ? 1 : 0) ||
        (isStudent(a) ? cmp(low(a.name), low(b.name)) : cmp(adultName(a), adultName(b)) || (kindOf(a) === 'guest' ? 1 : 0) - (kindOf(b) === 'guest' ? 1 : 0) || cmp(low(a.name), low(b.name)));
    });
  }

  function seatingTab(rows) {
    var out = [[SEATING_NOTE], SEATING_HEADERS];
    seatingOrder(rows).forEach(function (r) {
      out.push([isNaN(r.table) ? r.tableText : r.table, r.name, kindOf(r) === 'guest' ? 'Guest' : kindOf(r) === 'faculty' ? 'Faculty' : 'Student', r.form, r.role, r.email, r.locked ? 'Yes' : '', r.why]);
    });
    return { rows: out, bold: [2], freeze: 2 };
  }

  // SM By table: one block per table, the table number in bold, adults and guests, then students.
  function byTableTab(rows) {
    var out = [SHARED_HEADERS['SM By table']], bold = [1], tables = [], seen = {};
    seatingOrder(rows).forEach(function (r) { if (!seen[r.tableText]) { seen[r.tableText] = true; tables.push(r.tableText); } });
    tables.forEach(function (tt, i) {
      if (i > 0) out.push(['', '', '']);
      out.push(['Table ' + tt, '', '']);
      bold.push(out.length);
      seatingOrder(rows.filter(function (r) { return r.tableText === tt; })).forEach(function (r) {
        if (kindOf(r) === 'guest') out.push([/^guest of /i.test(r.name) ? r.name : r.name + (r.host ? ' (guest of ' + r.host.name + ')' : ' (guest)'), '', '']);
        else if (kindOf(r) === 'faculty') out.push([r.name, '', '']);
        else out.push([r.name, r.form, r.role]);
      });
    });
    return { rows: out, bold: bold, freeze: 1 };
  }

  function byFirstTab(rows) {
    var list = rows.filter(isStudent).map(function (r) { var p = parts(r); return [p.first, p.last, r.form, r.tableText, r.role]; });
    list.sort(function (a, b) { return cmp(low(a[0]), low(b[0])) || cmp(low(a[1]), low(b[1])); });
    return { rows: [SHARED_HEADERS['SM By first name']].concat(list), bold: [1], freeze: 1 };
  }

  function byFormTab(rows, forms) {
    var out = [SHARED_HEADERS['SM By form']], bold = [1], all = forms.slice();
    rows.filter(isStudent).forEach(function (r) { if (all.indexOf(r.form) < 0) all.push(r.form); });
    all.forEach(function (f) {
      var list = rows.filter(function (r) { return isStudent(r) && r.form === f; }).map(function (r) { var p = parts(r); return [f, p.last, p.first, r.tableText, r.role]; });
      if (!list.length) return;
      list.sort(function (a, b) { return cmp(low(a[1]), low(b[1])) || cmp(low(a[2]), low(b[2])); });
      out.push([f, '', '', '', '']);
      bold.push(out.length);
      out = out.concat(list);
    });
    return { rows: out, bold: bold, freeze: 1 };
  }

  function facultyTab(rows) {
    var list = rows.filter(function (r) { return kindOf(r) === 'faculty'; }).map(function (r) {
      var guests = rows.filter(function (g) { return kindOf(g) === 'guest' && ((g.host && r.person && g.host === r.person) || (!g.host && low(g.email) === low(r.email) && r.email)); });
      var named = guests.filter(function (g) { return !/^guest of /i.test(g.name); }).map(function (g) { return g.name; }), extra = guests.length - named.length;
      var text = named.join(', ') + (extra ? (named.length ? ', ' : '') + extra + ' more guest seat' + (extra === 1 ? '' : 's') : '');
      var last = r.person ? r.person.last : parts(r).last;
      return { sort: low(last) + ' ' + low(r.name), row: [r.name, r.tableText, text] };
    });
    list.sort(function (a, b) { return cmp(a.sort, b.sort); });
    return { rows: [SHARED_HEADERS['SM Faculty']].concat(list.map(function (x) { return x.row; })), bold: [1], freeze: 1 };
  }

  function checkTab(check) {
    return { rows: [CHECK_HEADERS].concat(check.rows.map(function (r) { return [r.rule, r.result, r.details]; })), bold: [1], freeze: 1 };
  }

  function needsTab(needs) {
    var list = needs.slice().sort(function (a, b) {
      var x = NEEDS_ORDER.indexOf(a.section), y = NEEDS_ORDER.indexOf(b.section);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
    });
    var rows = [NEEDS_HEADERS].concat(list.map(function (n) { return [n.section, n.name, n.email, n.problem]; }));
    if (!list.length) rows.push(['', '', '', 'Nothing needs a person right now.']);
    return { rows: rows, bold: [1], freeze: 1 };
  }

  // Every SM tab for one Sort (with SM Seating) or Check again (without it).
  function allTabs(model, result, includeSeating) {
    var rows = result.rows, out = {};
    if (includeSeating) out['SM Seating'] = seatingTab(rows);
    out['SM By first name'] = byFirstTab(rows);
    out['SM By form'] = byFormTab(rows, model.forms);
    out['SM By table'] = byTableTab(rows);
    out['SM Faculty'] = facultyTab(rows);
    out['SM Check'] = checkTab(result.check);
    out['SM Needs you'] = needsTab(result.needs);
    return out;
  }

  function counts(result) {
    var c = { students: 0, faculty: 0 };
    result.rows.forEach(function (r) { if (kindOf(r) === 'faculty') c.faculty++; else if (isStudent(r)) c.students++; });
    return c;
  }
  function rulesUsed(ctx) {
    var on = [], off = [];
    ctx.rules.forEach(function (r) {
      var label = r.rank + ' ' + SHORT[r.id] + (r.id === 'forms' ? ' >= ' + r.value : r.id === 'perForm' ? ' <= ' + r.value : '');
      if (r.status === 'active') on.push(label); else off.push(r.rank + ' ' + SHORT[r.id]);
    });
    return 'On: ' + (on.join(', ') || 'none') + '. Off or not checked: ' + (off.join(', ') || 'none') + '.';
  }
  function runLogRow(model, result, who, time) {
    var c = counts(result), ev = model.event;
    return [time, who, ev.name, ev.date, ev.sort, ev.seed, rulesUsed(result.ctx), c.students, c.faculty, result.ctx.tables.length, result.check.rulesNotMet];
  }

  function extras(model) {
    var lines = ['Students: used ' + model.season.label + (model.season.setAside ? '; set aside ' + model.season.setAside + ' rows from other seasons.' : '.')];
    model.warnings.forEach(function (w) { lines.push(w); });
    return '\n\n' + lines.join('\n');
  }
  function sortMessage(model, result) {
    var c = counts(result), chk = result.check;
    return 'Seated ' + c.students + ' students and ' + c.faculty + ' faculty at ' + result.ctx.tables.length + ' tables. ' +
      chk.rulesNotMet + ' rules not fully met. Read SM Check, then SM Needs you. When it looks right, share the four shared tabs.' +
      (chk.failures ? '\n\n' + chk.failures + ' hard limits failed: see the Fail rows in SM Check.' : '') + extras(model);
  }
  function checkMessage(result) {
    return 'Checked: ' + result.check.failures + ' failures, ' + result.check.warnings + ' warnings. Read SM Check.';
  }

  return {
    SEATING_NOTE: SEATING_NOTE, SEATING_HEADERS: SEATING_HEADERS, SHARED_HEADERS: SHARED_HEADERS, CHECK_HEADERS: CHECK_HEADERS, NEEDS_HEADERS: NEEDS_HEADERS,
    RUN_LOG_HEADERS: RUN_LOG_HEADERS, TAB_ORDER: TAB_ORDER,
    safeCell: safeCell, grid: grid, columnLetter: columnLetter, allTabs: allTabs, seatingTab: seatingTab, byTableTab: byTableTab,
    byFirstTab: byFirstTab, byFormTab: byFormTab, facultyTab: facultyTab, checkTab: checkTab, needsTab: needsTab,
    runLogRow: runLogRow, sortMessage: sortMessage, checkMessage: checkMessage
  };
}());
