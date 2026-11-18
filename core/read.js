/*
 * Seated Meals: reading the workbook.
 *
 * Turns the raw cell values of every tab (each read with one getValues) into plain objects the
 * rest of the program uses: the event settings, the tables, the rules, the students, the faculty,
 * absences, locked seats and the history tabs. Columns are found by a keyword in their header,
 * never by column letter, because exports change. Nothing here touches Google Sheets, so the same
 * code runs in Apps Script and in the Node tests.
 */
var SMRead = (function () {
  'use strict';

  // ---------- Defaults for the setup tabs ----------

  // Event tab: Key | Value | Note. Values are typed as text; Sheets may turn some into numbers or dates.
  var EVENT_DEFAULTS = [
    ['Event name', 'Candlelight', 'Saved with this event in the history tabs.'],
    ['Date', '2026-12-15', 'The day of the dinner, as YYYY-MM-DD.'],
    ['Sort', 'Mixed', 'Mixed deals each form across the tables. Together keeps a group (see Together by) at the same tables.'],
    ['Together by', 'Advisory', 'For the Together sort: Advisory, Sport, Form, Boarding or day, or any header in the Students tab.'],
    ['Seats per table', '10', 'Seats at each table, unless the Tables tab gives a number.'],
    ['Adults per table', '2', 'How many faculty Sort aims for at each table.'],
    ['Waiters per table', '1', 'Students picked as the waiter at each table.'],
    ['Assistants per table', '1', 'Students picked as the assistant waiter at each table.'],
    ['Waiter forms', 'All', 'All, or forms separated by commas, for example: Junior, Sophomore'],
    ['Assistant forms', 'All', 'All, or forms separated by commas.'],
    ['Form names', '', 'Blank names the forms from YOG and SchoolYear. Example: 2027=Senior, 2028=Junior'],
    ['Season', '', 'Blank uses the latest season in Students. Example: Winter 2026 - 2027'],
    ["Faculty who didn't answer", "Don't seat", "For people on Faculty list who didn't answer the form: Don't seat, or Seat."],
    ['Seed', '1', 'Change it, or use Sort again with a new shuffle, for a different arrangement under the same rules.']
  ];

  // Every column the program reads: tab, name, default keyword, required. Keywords for the tabs
  // people fill in can be changed in Event with a row named "Column: <tab> <name>".
  var COLUMNS = [
    ['Students', 'Email', 'Email', true],
    ['Students', 'First name', 'FirstName|First name', true],
    ['Students', 'Nickname', 'Nickname|Preferred', false],
    ['Students', 'Last name', 'LastName|Last name', true],
    ['Students', 'Form', 'YOG|Form|Grade', true],
    ['Students', 'School year', 'SchoolYear', false],
    ['Students', 'Season', 'TeamSeason', false],
    ['Students', 'Sport', 'TeamName|TeanName|Sport', false],
    ['Students', 'Advisory', 'AdvisorGroup|Advisory', false],
    ['Students', 'Gender', 'Gender', false],
    ['Students', 'Boarding or day', 'BoardingDay|Boarding', false],
    ['Students', 'Dorm', 'Dorm', false],
    ['Students', 'New student', 'New student', false],
    ['Faculty', 'Timestamp', 'Timestamp', false],
    ['Faculty', 'Email', 'Email Address|Email', true],
    ['Faculty', 'Name', 'Your name', true],
    ['Faculty', 'Attend', 'attend', true],
    ['Faculty', 'Guests', 'spouse, partner or child', false],
    ['Faculty', 'Guest seats', 'seats should we save', false],
    ['Faculty', 'Colleagues', 'enjoy sitting with', false],
    ['Faculty', 'New', 'new to Pomfret', false],
    ['Faculty list', 'Name', 'Name', true],
    ['Faculty list', 'Email', 'Email', true],
    ['Faculty list', 'Group', 'Group|Advisory|AdvisorGroup', false],
    // The past event's name is one Name column, or first and last name columns joined. readPastEvent
    // finds these three itself ('manual'), because "First Name" and "Last Name" both contain "Name".
    ['Past event', 'Name', 'Name', false, 'manual'],
    ['Past event', 'First name', 'First|First name|FirstName', false, 'manual'],
    ['Past event', 'Last name', 'Last|Last name|LastName', false, 'manual'],
    ['Past event', 'Table', 'Table', true],
    ['Past event', 'Email', 'Email', false],
    ['Past event', 'Role', 'Role|Waiter', false],
    // Setup and working tabs. Their keywords are fixed (the program wrote the headers).
    ['Event', 'Key', 'Key', true],
    ['Event', 'Value', 'Value', true],
    ['Rules', 'Rank', 'Rank', true],
    ['Rules', 'Rule', 'Rule', true],
    ['Rules', 'On', 'On', true],
    ['Rules', 'Value', 'Value', false],
    ['Tables', 'Table', 'Table', true],
    ['Tables', 'Row', 'Row', true],
    ['Tables', 'In use', 'In use', true],
    ['Tables', 'Seats', 'Seats', false],
    ['Not attending', 'Email', 'Email', false],
    ['Not attending', 'Name', 'Name', false],
    ['Not attending', 'Why', 'Why', false],
    ['Locked seats', 'Email', 'Email', false],
    ['Locked seats', 'Name', 'Name', false],
    ['Locked seats', 'Table', 'Table', true],
    ['Locked seats', 'Why', 'Why', false],
    ['Seating history', 'Event', 'Event', true],
    ['Seating history', 'Date', 'Date', true],
    ['Seating history', 'Email', 'Email', true],
    ['Seating history', 'Name', 'Name', false],
    ['Seating history', 'Table', 'Table', true],
    ['Waiter history', 'Event', 'Event', true],
    ['Waiter history', 'Date', 'Date', true],
    ['Waiter history', 'Email', 'Email', true],
    ['Waiter history', 'Name', 'Name', false],
    ['Waiter history', 'Role', 'Role', true],
    ['SM Seating', 'Table', 'Table', true],
    ['SM Seating', 'Name', 'Name', true],
    ['SM Seating', 'Kind', 'Kind', true],
    ['SM Seating', 'Form', 'Form', false],
    ['SM Seating', 'Role', 'Role', true],
    ['SM Seating', 'Email', 'Email', true],
    ['SM Seating', 'Locked', 'Locked', false],
    ['SM Seating', 'Why', 'Why', false]
  ];
  // Only these tabs get "Column:" rows in Event (the others have headers the program wrote).
  var CONFIGURABLE = { 'Students': true, 'Faculty': true, 'Faculty list': true, 'Past event': true };

  // Rules tab defaults, in rank order. The id is how the program knows a rule; the text is what
  // people see, and the program recognizes a rule by phrases in it (see ruleId).
  var RULE_DEFAULTS = [
    { id: 'forms', text: 'At least this many forms at each table', on: 'Yes', value: 3, note: 'Mixed sort only.' },
    { id: 'perForm', text: 'At most this many students from one form at a table', on: 'Yes', value: 3, note: 'Mixed sort only.' },
    { id: 'tablemates', text: 'Nobody sits with a tablemate from the last event', on: 'Yes', value: '', note: 'Uses Seating history.' },
    { id: 'waited', text: 'Each table has a student who has waited before', on: 'Yes', value: '', note: 'Uses Waiter history.' },
    { id: 'neighbors', text: 'Split groups sit at neighboring tables', on: 'Yes', value: '', note: 'Together sort only.' },
    { id: 'gender', text: 'Gender mixed: no table with exactly one student of a gender', on: 'No', value: '', note: 'Counts Female and Male. Needs a Gender column.' },
    { id: 'boarding', text: 'Boarders and day students mixed at every table', on: 'No', value: '', note: 'Needs a BoardingDay column.' },
    { id: 'sameStudents', text: 'Students not at the same table number as last event', on: 'Yes', value: '', note: 'Uses Seating history.' },
    { id: 'sameFaculty', text: 'Faculty not at the same table number as last event', on: 'Yes', value: '', note: 'Uses Seating history.' }
  ];

  // The dining hall: five rows of round tables. Only consecutive numbers in the same row are neighbors.
  var ROOM_ROWS = [['A', 1, 10], ['B', 11, 19], ['C', 20, 28], ['D', 29, 38], ['E', 39, 47]];

  var SEASON_ORDER = { fall: 1, winter: 2, spring: 3 };
  var FORM_ORDER = ['Senior', 'Junior', 'Sophomore', 'Freshman'];

  // ---------- Small text helpers ----------

  // Every cell becomes trimmed text. Dates are read separately with dateKey.
  function text(v) { return v == null ? '' : String(v).trim(); }
  // For comparing words people type: lowercase, one space between words, straight apostrophes.
  function norm(v) { return text(v).replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase(); }
  function isDate(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function validDay(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900; }
  // A date cell or a typed date (2026-12-15 or 12/15/2026) as YYYY-MM-DD, or '' if it can't be read.
  function dateKey(v) {
    if (isDate(v)) return isNaN(v.getTime()) ? '' : v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
    var s = text(v), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m && validDay(+m[1], +m[2], +m[3])) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m && validDay(+m[3], +m[1], +m[2])) return m[3] + '-' + pad2(+m[1]) + '-' + pad2(+m[2]);
    return '';
  }
  // A form timestamp as a number for comparing which answer came later (NaN if unreadable).
  function timeValue(v) { return isDate(v) ? v.getTime() : Date.parse(text(v)); }
  function isBlankRow(row) {
    for (var i = 0; i < row.length; i++) if (text(row[i]) !== '') return false;
    return true;
  }
  function yes(v) { return /^y/.test(norm(v)); }
  function wholeNumber(v) { var s = text(v); return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN; }
  function sortText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  // Splits a list of names typed into one answer: commas, semicolons, "and", "&", "+" and line breaks.
  function splitNames(v) {
    return text(v).split(/\s*(?:,|;|&|\+|\r?\n|\band\b)\s*/i).map(text).filter(function (s) { return s !== ''; });
  }

  // ---------- Faculty answers, read the way people type them ----------

  // Answers that mean nobody is joining (question 4), compared as lowercase words without
  // punctuation. The slash stays, so "n/a" is "n/a".
  var NOBODY = ['no', 'none', 'n/a', 'na', 'n a', 'nope', 'not', 'nobody', 'no one', 'noone', 'just me', 'only me', 'just myself', 'myself', 'me'];
  // Words people add to a "no" that don't change it ("None this time", "No, thank you").
  var NOBODY_EXTRAS = ['thanks', 'thank', 'you', 'this', 'time', 'at', 'for', 'now', 'guest', 'guests', 'sorry', 'coming', 'joining'];
  // More answers that mean no request at all (question 6).
  var NO_PREFERENCE = ['no preference', 'no preferences', 'anyone', 'anybody', 'whoever', 'anywhere', 'doesnt matter', 'does not matter', 'no one in particular'];
  // Words that say who someone is rather than their name ("my wife", "our two kids").
  var RELATION_WORDS = ['my', 'our', 'both', 'one', 'two', 'three', 'four', 'husband', 'wife', 'spouse', 'partner', 'son', 'sons',
    'daughter', 'daughters', 'child', 'children', 'kid', 'kids', 'boyfriend', 'girlfriend', 'fiance', 'fiancee'];
  // Words that, left on their own, name nobody ("also faculty", "too").
  var FILLER_WORDS = ['also', 'too', 'faculty', 'staff', 'teacher', 'colleague', 'here', 'works', 'at', 'school', 'as', 'well', 'with', 'me'];

  // A short answer as lowercase words without punctuation, to compare with the lists above.
  function answerKey(v) { return norm(v).replace(/'/g, '').replace(/[^a-z0-9\/\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  // True when a whole answer means nobody: blank, "No", "None.", "N/A", "-", "No, just me".
  // more lists extra answers that count (question 6 adds "No preference" and the like).
  function meansNobody(v, more) {
    var parts = text(v).split(/[,;]/).map(answerKey).filter(function (s) { return s !== ''; });
    return parts.every(function (part) {
      var core = part.split(' ').filter(function (w) { return NOBODY_EXTRAS.indexOf(w) < 0; }).join(' ');
      return core === '' || NOBODY.indexOf(core) >= 0 || (more || []).indexOf(core) >= 0;
    });
  }
  function isRelationWord(w) { var k = nameKey(w); return RELATION_WORDS.indexOf(k) >= 0 || /^\d+$/.test(k); }
  // One typed guest made into a name: anything in parentheses dropped, and the words at the start
  // that only say who they are ("my wife Sarah" leaves "Sarah"). name is '' when no name is left;
  // relation says the piece named someone only by who they are ("My husband").
  function cleanGuest(piece) {
    var words = text(piece).replace(/\([^)]*\)/g, ' ').split(/\s+/).filter(function (w) { return w !== ''; }), relation = false;
    while (words.length && isRelationWord(words[0])) { words.shift(); relation = true; }
    var onlyFiller = words.every(function (w) { return FILLER_WORDS.indexOf(nameKey(w)) >= 0; });
    var name = words.join(' ').replace(/^[\s,.:;!-]+|[\s,.:;!-]+$/g, '');
    return { name: onlyFiller ? '' : name, relation: relation };
  }
  // Question 4, cleaned. names: the typed names left after cleaning. mentioned: the answer said
  // someone is coming, even with no name ("Yes", "My wife"). unnamed: how many pieces named
  // someone only by who they are, used when question 5 is blank.
  function guestAnswer(v) {
    if (meansNobody(v)) return { names: [], mentioned: false, unnamed: 0 };
    var rest = text(v).replace(/^\s*yes\b[\s,.:;!-]*/i, ''), names = [], unnamed = 0;
    splitNames(rest).forEach(function (piece) {
      var c = cleanGuest(piece);
      if (c.name) names.push(c.name);
      else if (c.relation) unnamed++;
    });
    return { names: names, mentioned: true, unnamed: unnamed };
  }
  // Question 6, cleaned: the colleague names typed, or none for "No preference" and the like.
  function colleagueAnswer(v) {
    if (meansNobody(v, NO_PREFERENCE)) return [];
    return splitNames(v).filter(function (piece) { return !meansNobody(piece, NO_PREFERENCE); });
  }

  // ---------- Name matching (used for faculty answers and by SMHistory for past events) ----------

  // A name as lowercase words, with accents, anything in parentheses and punctuation dropped.
  function nameWords(v) {
    var s = text(v);
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    return s ? s.split(' ') : [];
  }
  function nameKey(v) { return nameWords(v).join(' '); }
  // Edit distance between two strings, to suggest the closest names when nothing matches.
  function distance(a, b) {
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  // Matches a typed name to one person. People have shownFirst, legalFirst and last. The steps, in
  // order: shown first + last, legal first + last, the two in either order (last first), then last
  // name + first initial. A step that finds exactly one person wins; a step that finds more than
  // one stops with ambiguous (closest then lists up to three of them).
  function matchName(typed, people) {
    var w = nameWords(typed), joined = w.join(' ');
    if (!w.length) return { match: null, ambiguous: [], closest: [] };
    var tail = w.slice(1).join(' '), initial = w[0].charAt(0);
    var steps = [
      function (k) { return k.shown === joined; },
      function (k) { return k.legal === joined; },
      function (k) { return w.length >= 2 && (k.lastShown === joined || k.lastLegal === joined); },
      function (k) { return w.length === k.lastCount + 1 && tail === k.last && (k.shownInitial === initial || k.legalInitial === initial); }
    ];
    for (var s = 0; s < steps.length; s++) {
      // A person matches a step when any name they go by does.
      var hits = people.filter(function (p) { return matchKeys(p).some(steps[s]); });
      if (hits.length === 1) return { match: hits[0], ambiguous: [], closest: [] };
      if (hits.length > 1) return { match: null, ambiguous: hits, closest: hits.slice(0, 3) };
    }
    return { match: null, ambiguous: [], closest: [] };
  }
  // The three people whose names are nearest to a typed name (by edit distance), to suggest when
  // nothing matched. Slower than matchName, so only called for rows that matched nobody.
  function closestNames(typed, people) {
    var joined = nameKey(typed);
    return people.map(function (p) {
      var keys = matchKeys(p), d = Infinity;
      keys.forEach(function (k) { d = Math.min(d, distance(joined, k.shown), distance(joined, k.legal)); });
      return { p: p, d: d, key: keys[0].shown };
    }).sort(function (a, b) { return a.d - b.d || sortText(a.key, b.key); }).slice(0, 3).map(function (x) { return x.p; });
  }
  // The name forms matchName compares, worked out once per person and kept on the object, so
  // matching hundreds of rows stays fast in Apps Script. One set for each name a person goes by:
  // their name in Students or on the Faculty list, plus any in p.otherNames (for faculty, the
  // name they typed into the form when it differs from the list).
  function matchKeys(p) {
    if (p.matchKeys) return p.matchKeys;
    var sets = [keySet(p.shownFirst, p.legalFirst, p.last)];
    (p.otherNames || []).forEach(function (n) { sets.push(keySet(n.first, n.first, n.last)); });
    p.matchKeys = sets;
    return sets;
  }
  function keySet(shownFirst, legalFirst, lastName) {
    var last = nameWords(lastName), shown = nameKey(shownFirst), legal = nameKey(legalFirst);
    return {
      shown: nameKey(shownFirst + ' ' + lastName), legal: nameKey(legalFirst + ' ' + lastName),
      lastShown: nameKey(lastName + ' ' + shownFirst), lastLegal: nameKey(lastName + ' ' + legalFirst),
      last: last.join(' '), lastCount: last.length, shownInitial: shown.charAt(0), legalInitial: legal.charAt(0)
    };
  }
  // True when the words of a full name appear one after another inside the typed words, as in
  // "my husband John Smithson".
  function containsWords(words, part) {
    for (var i = 0; i + part.length <= words.length; i++) {
      var same = true;
      for (var j = 0; j < part.length && same; j++) same = words[i + j] === part[j];
      if (same) return true;
    }
    return false;
  }
  // The people whose full name (first and last, any name they go by) appears inside a typed answer.
  function namedInside(typed, people) {
    var words = nameWords(typed);
    return people.filter(function (p) {
      return matchKeys(p).some(function (k) {
        return [k.shown, k.legal].some(function (full) { var part = full.split(' '); return part.length > 1 && containsWords(words, part); });
      });
    });
  }
  // A faculty name as first and last name. "Last, First" is turned around; otherwise the last
  // word is the last name.
  function splitFacultyName(name) {
    var t = text(name), comma = t.indexOf(',');
    if (comma > 0) return { first: text(t.slice(comma + 1)), last: text(t.slice(0, comma)) };
    var words = t.split(/\s+/);
    return { first: words.slice(0, -1).join(' ') || words[0] || '', last: words.length > 1 ? words[words.length - 1] : '' };
  }

  // ---------- Columns ----------

  // Finds a column by keyword. Alternatives are separated by "|" and tried in order. A header that
  // equals the keyword wins; otherwise a header containing it. Returns -1 for a missing optional
  // column, and stops with a message for a missing required one or one that matches two headers.
  function findColumn(headers, keyword, required, tab, label) {
    var normHeaders = headers.map(norm), alts = String(keyword).split('|').map(norm).filter(function (a) { return a !== ''; });
    for (var a = 0; a < alts.length; a++) {
      var exact = [], inside = [];
      for (var i = 0; i < normHeaders.length; i++) {
        if (normHeaders[i] === alts[a]) exact.push(i);
        else if (normHeaders[i] !== '' && normHeaders[i].indexOf(alts[a]) >= 0) inside.push(i);
      }
      if (exact.length) return exact[0];
      if (inside.length === 1) return inside[0];
      if (inside.length > 1) {
        throw new Error('The ' + tab + ' tab has more than one column that could be "' + label + '" (keyword "' + keyword + '"): ' +
          inside.map(function (j) { return '"' + text(headers[j]) + '"'; }).join(', ') + '. Rename one header, or set the "Column: ' + tab + ' ' + label + '" row in Event to the exact header.');
      }
    }
    if (required) {
      throw new Error('The ' + tab + ' tab has no column for "' + label + '" (keyword "' + keyword + '"). Its headers are: ' +
        (headers.filter(function (h) { return text(h) !== ''; }).map(function (h) { return '"' + text(h) + '"'; }).join(', ') || 'none') +
        '. Fix the header, or set the "Column: ' + tab + ' ' + label + '" row in Event to the exact header.');
    }
    return -1;
  }
  // Finds every column of one tab. headerRow is 0 unless the tab has a note above its headers.
  function columnsOf(tab, values, ev, headerRow) {
    var headers = ((values && values[headerRow || 0]) || []).map(text), idx = {};
    COLUMNS.forEach(function (c) {
      if (c[0] !== tab || c[4] === 'manual') return;
      idx[c[1]] = findColumn(headers, keywordFor(c, ev), c[3], tab, c[1]);
    });
    return { headers: headers, idx: idx };
  }
  // A column's keyword: the "Column: <tab> <name>" row in Event when there is one, else the default.
  function keywordFor(c, ev) { return (CONFIGURABLE[c[0]] && ev && ev.columns[c[0] + ' ' + c[1]]) || c[2]; }
  function columnDef(tab, label) { return COLUMNS.filter(function (c) { return c[0] === tab && c[1] === label; })[0]; }
  // The first header that is exactly one of a keyword's alternatives, or -1.
  function exactColumn(headers, keyword) {
    var alts = String(keyword).split('|').map(norm);
    for (var a = 0; a < alts.length; a++) {
      for (var i = 0; i < headers.length; i++) if (alts[a] !== '' && norm(headers[i]) === alts[a]) return i;
    }
    return -1;
  }
  // The non-blank rows below the header, each with its spreadsheet row number.
  function dataRows(values, headerRow) {
    var out = [];
    for (var i = (headerRow || 0) + 1; i < values.length; i++) if (!isBlankRow(values[i])) out.push({ row: i + 1, cells: values[i] });
    return out;
  }
  function cellText(r, i) { return i < 0 ? '' : text(r.cells[i]); }

  // ---------- Setup tabs ----------

  function columnKeywordRows() {
    return COLUMNS.filter(function (c) { return CONFIGURABLE[c[0]]; }).map(function (c) {
      return ['Column: ' + c[0] + ' ' + c[1], c[2], (c[3] ? 'Required. ' : '') + 'Header keyword; "|" separates alternatives.'];
    });
  }
  // The rows each setup tab starts with. createTabOnce_ writes them only when the tab is missing.
  function setupDefaults() {
    var tables = [];
    ROOM_ROWS.forEach(function (r) { for (var n = r[1]; n <= r[2]; n++) tables.push([n, r[0], n === 47 ? 'No' : 'Yes', '']); });
    return {
      'Event': [['Key', 'Value', 'Note']].concat(EVENT_DEFAULTS, columnKeywordRows()),
      'Rules': [['Rank', 'Rule', 'On', 'Value', 'Note']].concat(RULE_DEFAULTS.map(function (r, i) { return [i + 1, r.text, r.on, r.value, r.note]; })),
      'Tables': [['Table', 'Row', 'In use', 'Seats']].concat(tables),
      'Not attending': [['Email', 'Name', 'Why']],
      'Locked seats': [['Email', 'Name', 'Table', 'Why']],
      'Seating history': [['Event', 'Date', 'Email', 'Name', 'Table']],
      'Waiter history': [['Event', 'Date', 'Email', 'Name', 'Role']]
    };
  }

  // ---------- Event ----------

  // Reads the Event tab into settings. A missing or unreadable value falls back to its default,
  // with a warning for the finish message.
  function readEvent(values) {
    var warnings = [], raw = {}, columns = {};
    if (values && values.length) {
      var c = columnsOf('Event', values, null);
      dataRows(values).forEach(function (r) {
        var key = norm(r.cells[c.idx.Key]);
        if (key) raw[key] = r.cells[c.idx.Value];
      });
    }
    function get(name) { return Object.prototype.hasOwnProperty.call(raw, norm(name)) ? raw[norm(name)] : undefined; }
    function fallback(name, why) {
      var d = EVENT_DEFAULTS.filter(function (e) { return e[0] === name; })[0][1];
      warnings.push('Event "' + name + '": ' + why + ', so the default "' + d + '" was used.');
      return d;
    }
    function textSetting(name) {
      var v = get(name);
      if (v === undefined) return fallback(name, 'no row');
      return text(v);
    }
    function numberSetting(name, min) {
      var v = get(name), n = wholeNumber(v);
      if (v === undefined) return +fallback(name, 'no row');
      if (isNaN(n) || n < min) return +fallback(name, '"' + text(v) + '" is not a whole number of at least ' + min);
      return n;
    }
    function formList(name) {
      var v = norm(textSetting(name));
      if (v === '' || v === 'all') return null;
      return v.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
    }

    var ev = { warnings: warnings };
    ev.name = textSetting('Event name') || fallback('Event name', 'it is blank');
    var date = get('Date');
    ev.date = dateKey(date) || dateKey(fallback('Date', date === undefined ? 'no row' : '"' + text(date) + '" is not a date like 2026-12-15'));
    var sort = norm(textSetting('Sort'));
    ev.sort = sort === 'mixed' ? 'Mixed' : sort === 'together' ? 'Together' : fallback('Sort', '"' + sort + '" is not Mixed or Together');
    ev.togetherBy = textSetting('Together by') || 'Advisory';
    ev.seatsPerTable = numberSetting('Seats per table', 1);
    ev.adultsPerTable = numberSetting('Adults per table', 0);
    ev.waitersPerTable = numberSetting('Waiters per table', 0);
    ev.assistantsPerTable = numberSetting('Assistants per table', 0);
    ev.waiterForms = formList('Waiter forms');
    ev.assistantForms = formList('Assistant forms');
    ev.formNames = {};
    textSetting('Form names').split(',').forEach(function (pair) {
      var bits = pair.split('=');
      if (bits.length === 2 && text(bits[0]) && text(bits[1])) ev.formNames[norm(bits[0])] = text(bits[1]);
      else if (text(pair)) warnings.push('Event "Form names": "' + text(pair) + '" is not like 2027=Senior, so it was skipped.');
    });
    ev.season = textSetting('Season');
    var noAnswer = norm(textSetting("Faculty who didn't answer")).replace(/'/g, '');
    ev.facultyNoAnswer = noAnswer === 'seat' ? 'Seat' : noAnswer === 'dont seat' ? "Don't seat" : fallback("Faculty who didn't answer", '"' + noAnswer + '" is not Seat or Don\'t seat');
    var seed = get('Seed'), n = wholeNumber(seed);
    ev.seed = isNaN(n) ? +fallback('Seed', seed === undefined ? 'no row' : '"' + text(seed) + '" is not a whole number') : n;
    COLUMNS.forEach(function (c) {
      if (!CONFIGURABLE[c[0]]) return;
      var v = text(get('Column: ' + c[0] + ' ' + c[1]));
      if (v) columns[c[0] + ' ' + c[1]] = v;
    });
    ev.columns = columns;
    return ev;
  }

  // ---------- Tables and rules ----------

  function readTables(values, ev) {
    if (!values || !values.length) throw new Error('There is no Tables tab. Run any Seated Meals menu item once to create it with the room map.');
    var c = columnsOf('Tables', values, ev), seen = {}, tables = [];
    dataRows(values).forEach(function (r) {
      var num = wholeNumber(r.cells[c.idx.Table]);
      if (isNaN(num) || num < 1) { ev.warnings.push('Tables row ' + r.row + ': "' + cellText(r, c.idx.Table) + '" is not a table number, so the row was skipped.'); return; }
      if (seen[num]) { ev.warnings.push('Tables row ' + r.row + ': table ' + num + ' is listed twice; the first row was used.'); return; }
      seen[num] = true;
      var seats = wholeNumber(cellText(r, c.idx.Seats));
      if (cellText(r, c.idx.Seats) !== '' && (isNaN(seats) || seats < 1)) {
        ev.warnings.push('Tables row ' + r.row + ': Seats "' + cellText(r, c.idx.Seats) + '" is not a number, so ' + ev.seatsPerTable + ' was used.');
        seats = NaN;
      }
      tables.push({ num: num, row: cellText(r, c.idx.Row).toUpperCase(), inUse: yes(r.cells[c.idx['In use']]), seats: isNaN(seats) ? ev.seatsPerTable : seats });
    });
    tables.sort(function (a, b) { return a.num - b.num; });
    return tables;
  }

  // Which rule a Rules row is, from phrases in its text ('' if it isn't one the tool knows).
  function ruleId(t) {
    var n = norm(t);
    if (n.indexOf('forms at each table') >= 0) return 'forms';
    if (n.indexOf('from one form') >= 0) return 'perForm';
    if (n.indexOf('tablemate') >= 0) return 'tablemates';
    if (n.indexOf('waited') >= 0) return 'waited';
    if (n.indexOf('neighbo') >= 0) return 'neighbors';
    if (n.indexOf('gender') >= 0) return 'gender';
    if (n.indexOf('boarder') >= 0 || n.indexOf('day student') >= 0) return 'boarding';
    if (n.indexOf('table number') >= 0 && n.indexOf('student') === 0) return 'sameStudents';
    if (n.indexOf('table number') >= 0 && n.indexOf('faculty') === 0) return 'sameFaculty';
    return '';
  }
  // Reads the Rules tab: each rule's rank, on or off, and value. Rules missing from the tab are off.
  function readRules(values, ev) {
    if (!values || !values.length) throw new Error('There is no Rules tab. Run any Seated Meals menu item once to create it.');
    var c = columnsOf('Rules', values, ev), seen = {}, rules = [];
    dataRows(values).forEach(function (r, order) {
      var t = cellText(r, c.idx.Rule), id = ruleId(t);
      if (!id) { ev.warnings.push('Rules row ' + r.row + ': "' + t + '" is not a rule this tool knows, so it was skipped.'); return; }
      if (seen[id]) { ev.warnings.push('Rules row ' + r.row + ': this rule is listed twice; the first row was used.'); return; }
      seen[id] = true;
      var def = RULE_DEFAULTS.filter(function (d) { return d.id === id; })[0], value = def.value;
      if (id === 'forms' || id === 'perForm') {
        var v = wholeNumber(cellText(r, c.idx.Value));
        if (isNaN(v) || v < 1) ev.warnings.push('Rules row ' + r.row + ': value "' + cellText(r, c.idx.Value) + '" is not a whole number, so ' + def.value + ' was used.');
        else value = v;
      }
      var rank = wholeNumber(cellText(r, c.idx.Rank));
      rules.push({ id: id, text: t, rank: isNaN(rank) ? 999 : rank, order: order, on: yes(r.cells[c.idx.On]), value: value, missing: false });
    });
    RULE_DEFAULTS.forEach(function (d, i) {
      if (!seen[d.id]) rules.push({ id: d.id, text: d.text, rank: 1000 + i, order: 1000 + i, on: false, value: d.value, missing: true });
    });
    rules.sort(function (a, b) { return a.rank - b.rank || a.order - b.order; });
    rules.forEach(function (r, i) { r.position = i + 1; });
    return rules;
  }

  // ---------- Students ----------

  function seasonLabel(season, year) { return text(season) + ' ' + text(year); }
  function squash(v) { return norm(v).replace(/\s+/g, ''); }
  function yearStart(v) { var m = text(v).match(/\d{4}/); return m ? +m[0] : -1; }

  // Reads the Students tab (Mr. Sheehan's export): keeps the current season's rows, names the
  // forms, builds each student's shown name, and lists missing and duplicate emails for SM Needs you.
  function readStudents(values, ev, needs) {
    if (!values || values.length < 2) throw new Error('The Students tab is missing or empty. Download the student file as CSV and import it as a tab named Students.');
    var c = columnsOf('Students', values, ev), idx = c.idx, rows = dataRows(values);
    var season = { label: 'all rows (no SchoolYear and TeamSeason columns)', setAside: 0 };

    if (idx['School year'] >= 0 && idx.Season >= 0) {
      var keep;
      if (ev.season) {
        keep = function (r) { return squash(seasonLabel(cellText(r, idx.Season), cellText(r, idx['School year']))) === squash(ev.season); };
        season.label = ev.season;
        if (!rows.some(keep)) {
          var labels = {};
          rows.forEach(function (r) { labels[seasonLabel(cellText(r, idx.Season), cellText(r, idx['School year']))] = true; });
          throw new Error('Event "Season" is "' + ev.season + '", but no Students row has that season. Seasons in Students: ' + Object.keys(labels).sort().join(', ') + '. Fix Season in Event, or leave it blank for the latest.');
        }
      } else {
        var latestYear = '', latestSeason = '';
        rows.forEach(function (r) {
          var y = cellText(r, idx['School year']);
          if (latestYear === '' || yearStart(y) > yearStart(latestYear) || (yearStart(y) === yearStart(latestYear) && y > latestYear)) latestYear = y;
        });
        rows.forEach(function (r) {
          var s = cellText(r, idx.Season);
          if (cellText(r, idx['School year']) === latestYear && (SEASON_ORDER[norm(s)] || 0) > (SEASON_ORDER[norm(latestSeason)] || 0)) latestSeason = s;
        });
        keep = function (r) { return cellText(r, idx['School year']) === latestYear && (!latestSeason || norm(cellText(r, idx.Season)) === norm(latestSeason)); };
        season.label = latestSeason ? seasonLabel(latestSeason, latestYear) : latestYear;
      }
      var kept = rows.filter(keep);
      season.setAside = rows.length - kept.length;
      // Students with rows only in other seasons are not seated, so a person should know.
      var inSeason = {};
      kept.forEach(function (r) { inSeason[norm(cellText(r, idx.Email))] = true; });
      var missing = {};
      rows.forEach(function (r) {
        var e = norm(cellText(r, idx.Email));
        if (e && !inSeason[e] && !missing[e]) {
          missing[e] = true;
          needs.push({ section: 'Data problems', name: cellText(r, idx['First name']) + ' ' + cellText(r, idx['Last name']), email: cellText(r, idx.Email),
            problem: 'Has no ' + season.label + ' row in Students, so this student is not seated. If the season is not complete yet, set Season in Event.' });
        }
      });
      rows = kept;
    }

    // Forms: four-digit class years are named from the school year (its end year is Senior).
    var endYear = -1;
    if (idx['School year'] >= 0 && rows.length) {
      var m = cellText(rows[0], idx['School year']).match(/(\d{4})\D+(\d{4})/);
      if (m) endYear = +m[2];
    }
    var formInfo = {};
    rows.forEach(function (r) {
      var raw = cellText(r, idx.Form);
      if (formInfo[raw]) return;
      var name = raw === '' ? 'No form' : raw, rank;
      if (/^\d{4}$/.test(raw)) {
        rank = +raw;
        var k = +raw - endYear;
        if (endYear > 0 && k >= 0 && k < FORM_ORDER.length) name = FORM_ORDER[k];
      } else {
        var known = FORM_ORDER.map(norm).indexOf(norm(raw));
        rank = known >= 0 ? 100000 + known : 200000;
      }
      if (ev.formNames[norm(raw)]) name = ev.formNames[norm(raw)];
      if (raw === '') rank = 300000;
      formInfo[raw] = { raw: raw, name: name, rank: rank };
    });
    var formList = Object.keys(formInfo).map(function (k) { return formInfo[k]; }).sort(function (a, b) { return a.rank - b.rank || sortText(a.name, b.name); });
    var forms = [];
    formList.forEach(function (f) { if (forms.indexOf(f.name) < 0) forms.push(f.name); });

    var has = {};
    ['Sport', 'Advisory', 'Gender', 'Boarding or day', 'Dorm', 'New student'].forEach(function (k) {
      has[k] = idx[k] >= 0 && rows.some(function (r) { return cellText(r, idx[k]) !== ''; });
    });

    var students = [], byEmail = {};
    rows.forEach(function (r) {
      var email = cellText(r, idx.Email), first = cellText(r, idx['First name']), nick = cellText(r, idx.Nickname), last = cellText(r, idx['Last name']);
      var shownFirst = nick || first, f = formInfo[cellText(r, idx.Form)];
      var s = {
        id: email ? email.toLowerCase() : 'row:' + r.row, email: email, row: r.row,
        legalFirst: first, shownFirst: shownFirst, last: last, name: (shownFirst + ' ' + last).trim(),
        form: f.name, formRaw: f.raw, formIndex: forms.indexOf(f.name),
        sport: cellText(r, idx.Sport), advisory: cellText(r, idx.Advisory), gender: cellText(r, idx.Gender),
        boarding: '', dorm: cellText(r, idx.Dorm), isNew: yes(cellText(r, idx['New student'])), cells: r.cells
      };
      var bd = norm(cellText(r, idx['Boarding or day']));
      s.boarding = bd === 'b' || bd.indexOf('board') === 0 ? 'Boarding' : bd === 'd' || bd.indexOf('day') === 0 ? 'Day' : cellText(r, idx['Boarding or day']);
      if (!email) {
        needs.push({ section: 'Data problems', name: s.name, email: '', problem: 'Students row ' + r.row + ' has no email, so history can\'t follow this student. Seated anyway.' });
      } else if (byEmail[s.id]) {
        needs.push({ section: 'Data problems', name: s.name, email: email, problem: 'Students row ' + r.row + ' has the same email as row ' + byEmail[s.id].row + ' in the current season. Kept row ' + byEmail[s.id].row + '.' });
        return;
      }
      if (email) byEmail[s.id] = s;
      students.push(s);
    });
    return { students: students, forms: forms, season: season, has: has, headers: c.headers };
  }

  // The Students value used by the Together sort. Known names map to fields; anything else is a header.
  function togetherValue(model) {
    var by = norm(model.event.togetherBy), fields = { advisory: 'advisory', sport: 'sport', form: 'form', 'boarding or day': 'boarding', boarding: 'boarding', gender: 'gender', dorm: 'dorm' };
    if (fields[by]) return { label: model.event.togetherBy, get: function (s) { return s[fields[by]]; } };
    var i = findColumn(model.studentHeaders, model.event.togetherBy, true, 'Students', 'Together by');
    return { label: text(model.studentHeaders[i]), get: function (s) { return text(s.cells[i]); } };
  }

  // ---------- Faculty ----------

  // Faculty come from the form responses (Faculty) and the optional Faculty list, joined by email.
  // Returns every known adult with: attending, guests, household links, colleague requests, New or
  // Mentor, and their group from the Faculty list. Problems go to needs.
  function readFaculty(formValues, listValues, ev, needs) {
    var adults = [], byId = {};
    function need(p, problem) { needs.push({ section: 'Data problems', name: p.name, email: p.email, problem: problem }); }
    // The name shown everywhere, split into first and last name for sorting and matching.
    function setName(p, name) {
      var parts = splitFacultyName(name);
      p.name = text(name); p.legalFirst = p.shownFirst = parts.first; p.last = parts.last;
    }
    function person(email, name, row) {
      var id = email ? email.toLowerCase() : 'faculty-row:' + row;
      var p = { id: id, email: email, name: '', legalFirst: '', shownFirst: '', last: '', otherNames: [],
        group: '', answered: false, onList: false, attending: false, guestNames: [], guestSeats: 0, householdIds: [], colleagueIds: [], isNew: false, isMentor: false, row: row };
      setName(p, name);
      byId[id] = p; adults.push(p);
      return p;
    }
    var hasList = !!(listValues && listValues.length > 1), answers = [];
    if (hasList) {
      var lc = columnsOf('Faculty list', listValues, ev);
      dataRows(listValues).forEach(function (r) {
        var email = cellText(r, lc.idx.Email), id = email.toLowerCase();
        if (email && byId[id]) { needs.push({ section: 'Data problems', name: cellText(r, lc.idx.Name), email: email, problem: 'Faculty list row ' + r.row + ' repeats an email; the first row was used.' }); return; }
        var p = person(email, cellText(r, lc.idx.Name), r.row);
        p.onList = true; p.group = cellText(r, lc.idx.Group);
      });
    }
    if (formValues && formValues.length > 1) {
      var fc = columnsOf('Faculty', formValues, ev), idx = fc.idx, latest = {};
      dataRows(formValues).forEach(function (r) {
        var a = { row: r.row, email: cellText(r, idx.Email), name: cellText(r, idx.Name), attend: cellText(r, idx.Attend), guests: cellText(r, idx.Guests),
          seats: cellText(r, idx['Guest seats']), colleagues: cellText(r, idx.Colleagues), newText: cellText(r, idx.New), time: idx.Timestamp >= 0 ? timeValue(r.cells[idx.Timestamp]) : NaN };
        var key = a.email ? a.email.toLowerCase() : 'faculty-row:' + r.row, before = latest[key];
        if (before) {
          var later = !(a.time < before.time) ? a : before, earlier = later === a ? before : a;
          needs.push({ section: 'Data problems', name: later.name, email: later.email, problem: 'Answered the faculty form twice (rows ' + earlier.row + ' and ' + later.row + '). Used the later answer, row ' + later.row + '.' });
          latest[key] = later;
        } else latest[key] = a;
      });
      Object.keys(latest).forEach(function (k) { answers.push(latest[k]); });
      answers.sort(function (a, b) { return a.row - b.row; });
      answers.forEach(function (a) {
        var p = byId[a.email ? a.email.toLowerCase() : 'faculty-row:' + a.row];
        if (!p) {
          p = person(a.email, a.name, a.row);
          if (hasList) need(p, 'Answered the faculty form but is not on Faculty list. Seated anyway.');
        }
        // On the Faculty list, the list's name is shown, because names typed into the form can be
        // lowercase, nicknames or "Last, First". The typed name still matches.
        if (a.name && (!p.onList || !p.name)) setName(p, a.name);
        else if (a.name && nameKey(a.name) !== nameKey(p.name)) p.otherNames.push(splitFacultyName(a.name));
        p.answered = true;
        p.answer = a;
        p.attending = !/^n/.test(norm(a.attend));
        var n = norm(a.newText);
        p.isNew = /^i\W?m new/.test(n);
        p.isMentor = !p.isNew && n.indexOf('glad') >= 0;
      });
    }

    // Names typed in the answers are matched to the faculty: by email, then by name words.
    function others(self) { return adults.filter(function (a) { return a !== self; }); }
    function findAdult(typed, self) {
      if (typed.indexOf('@') >= 0) {
        var hit = byId[norm(typed)];
        return { match: hit && hit !== self ? hit : null, ambiguous: [], closest: [] };
      }
      return matchName(typed, others(self));
    }
    // The name as typed, or else a faculty member's full name inside it ("John Smithson, also
    // faculty", "Jane Smithson from the science department").
    function findColleague(typed, self) {
      var m = findAdult(typed, self);
      if (m.match || m.ambiguous.length) return m;
      var inside = namedInside(typed, others(self));
      if (inside.length === 1) return { match: inside[0], ambiguous: [], closest: [] };
      if (inside.length > 1) return { match: null, ambiguous: inside, closest: inside.slice(0, 3) };
      return m;
    }
    // A question 4 name that means a faculty member, so a spouse who also works at the school sits
    // as a household: found as for a colleague, or a first name alone with the answerer's own last
    // name (Jane Smithson writing "my husband John" means John Smithson).
    function findPartner(typed, self) {
      var m = findColleague(typed, self);
      if (m.match || m.ambiguous.length) return m;
      if (nameWords(typed).length === 1 && self.last) return findAdult(typed + ' ' + self.last, self);
      return m;
    }
    // Puts a faculty member named in question 4 in p's household. One who answered No is not
    // seated. One on the Faculty list who didn't answer is coming with p, so is seated with them.
    function linkPartner(p, q) {
      if (q.answered && !q.attending) {
        need(p, p.name + ' named ' + q.name + ' as joining, but ' + q.name + ' answered No, so ' + q.name + ' is not seated.');
        return;
      }
      if (!q.answered && !q.joinedBy) {
        q.attending = true;
        q.joinedBy = p;
        need(q, 'Named by ' + p.name + ' as joining them, so seated together, but didn\'t answer the form.');
      }
      if (p.householdIds.indexOf(q.id) < 0) p.householdIds.push(q.id);
    }
    // How many guest seats to hold, and the SM Needs you rows when questions 4 and 5 disagree.
    // Never fewer seats than guest names: an empty seat is a smaller problem than a guest without one.
    function guestSeatCount(p, q4, asked, facultyNamed) {
      var named = p.guestNames.length, list = named ? ' (' + p.guestNames.join(', ') + ')' : '';
      var said = 'Said someone is joining ("' + text(p.answer.guests) + '")';
      if (!isNaN(asked)) {
        var seats = Math.max(0, asked - facultyNamed);
        if (named > seats) {
          need(p, 'Named ' + plural(named, 'guest') + ' but asked for ' + plural(seats, 'seat') + '. Held ' + plural(named, 'seat') + list + '.');
          return named;
        }
        if (seats === 0 && q4.mentioned && !facultyNamed) need(p, said + ' but asked for 0 seats, so none was held.');
        return seats;
      }
      // Question 5 left blank: a seat per guest name, or per "my wife"-style mention, and at least
      // one when the answer says someone is coming.
      var held = Math.max(named, q4.unnamed, q4.mentioned && !facultyNamed ? 1 : 0);
      if (held > 0) need(p, (named ? 'Named ' + plural(named, 'guest') : said) + ' but didn\'t say how many seats. Held ' + plural(held, 'seat') + list + '.');
      return held;
    }

    adults.forEach(function (p) {
      if (!p.answered || !p.attending) return;
      var a = p.answer, q4 = guestAnswer(a.guests), facultyNamed = 0;
      q4.names.forEach(function (typed) {
        var m = findPartner(typed, p);
        if (m.match) { facultyNamed++; linkPartner(p, m.match); return; }
        if (m.ambiguous.length) need(p, 'Guest "' + typed + '" matches more than one faculty member (' + m.ambiguous.map(function (x) { return x.name; }).join(', ') + '). Held a guest seat for them.');
        p.guestNames.push(typed);
      });
      var asked = wholeNumber(a.seats);
      if (a.seats !== '' && (isNaN(asked) || asked < 0)) {
        need(p, 'Guest seats answer "' + a.seats + '" is not a number, so it was read as blank.');
        asked = NaN;
      }
      p.guestSeats = guestSeatCount(p, q4, asked, facultyNamed);
      colleagueAnswer(a.colleagues).forEach(function (typed) {
        var m = findColleague(typed, p);
        if (m.match) { if (p.colleagueIds.indexOf(m.match.id) < 0) p.colleagueIds.push(m.match.id); }
        else if (m.ambiguous.length) need(p, 'Colleague "' + typed + '" matches more than one faculty member: ' + m.ambiguous.map(function (x) { return x.name; }).join(', ') + '.');
        else {
          var near = closestNames(typed, others(p));
          need(p, 'Colleague "' + typed + '" doesn\'t match anyone on the faculty.' + (near.length ? ' Closest: ' + near.map(function (x) { return x.name; }).join(', ') + '.' : ''));
        }
      });
    });
    // Faculty list people who didn't answer (and weren't named as coming by a partner).
    adults.forEach(function (p) {
      if (p.answered || !p.onList || p.joinedBy) return;
      if (ev.facultyNoAnswer === 'Seat') p.attending = true;
      else need(p, 'On Faculty list but didn\'t answer the faculty form, so not seated. Ask them, or set "Faculty who didn\'t answer" in Event to Seat.');
    });
    // Households go both ways: if one names the other, both are linked.
    adults.forEach(function (p) {
      p.householdIds.forEach(function (id) { var q = byId[id]; if (q && q.householdIds.indexOf(p.id) < 0) q.householdIds.push(p.id); });
    });
    return { adults: adults, hasList: hasList };
  }

  // ---------- Small setup tabs, history and the working list ----------

  function readSimple(tab, values, ev, map) {
    if (!values || !values.length) return [];
    var c = columnsOf(tab, values, ev);
    return dataRows(values).map(function (r) { return map(r, function (name) { return c.idx[name] === undefined ? '' : cellText(r, c.idx[name]); }, c.idx); });
  }
  function readNotAttending(values, ev) {
    return readSimple('Not attending', values, ev, function (r, get) { return { row: r.row, email: get('Email'), name: get('Name'), why: get('Why') }; });
  }
  function readLocks(values, ev) {
    return readSimple('Locked seats', values, ev, function (r, get) { return { row: r.row, email: get('Email'), name: get('Name'), table: get('Table'), why: get('Why') }; });
  }
  function readSeatingHistory(values, ev) {
    return readSimple('Seating history', values, ev, function (r, get, idx) {
      return { row: r.row, event: get('Event'), date: dateKey(r.cells[idx.Date]), email: get('Email'), id: get('Email').toLowerCase(), name: get('Name'), table: wholeNumber(get('Table')) };
    });
  }
  function readWaiterHistory(values, ev) {
    return readSimple('Waiter history', values, ev, function (r, get, idx) {
      return { row: r.row, event: get('Event'), date: dateKey(r.cells[idx.Date]), email: get('Email'), id: get('Email').toLowerCase(), name: get('Name'), role: get('Role') };
    });
  }
  // A Role or Waiter cell read as Waiter, Assistant or ''. Assistant is checked first, because
  // "Asst. Waiter" contains "waiter". His files mark them W and AW.
  function roleOf(v) {
    var n = norm(v).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (n === '') return '';
    if (/\bassist/.test(n) || /\basst\b/.test(n) || n === 'a' || n === 'aw') return 'Assistant';
    if (n.indexOf('waiter') >= 0 || /^(w|y|yes|x)$/.test(n)) return 'Waiter';
    return '';
  }
  // A Table cell read as a table number and anything after it: "12", "12 W", "Table 12".
  function tableCell(v) {
    var m = text(v).match(/^(?:table\s*)?(\d+)(?:\.0+)?\s*(.*)$/i);
    return m ? { table: +m[1], rest: text(m[2]) } : { table: NaN, rest: '' };
  }
  // Where the Past event's names are: a column that is exactly the Name keyword; else first and
  // last name columns, joined; else the Name keyword as usual (which stops with a message naming
  // the headers when it can't find one column).
  function pastNameColumns(headers, ev) {
    var nameKw = keywordFor(columnDef('Past event', 'Name'), ev), exact = exactColumn(headers, nameKw);
    if (exact >= 0) return { name: exact };
    var first = findColumn(headers, keywordFor(columnDef('Past event', 'First name'), ev), false, 'Past event', 'First name');
    var last = findColumn(headers, keywordFor(columnDef('Past event', 'Last name'), ev), false, 'Past event', 'Last name');
    if (first >= 0 && last >= 0 && first !== last) return { first: first, last: last };
    return { name: findColumn(headers, nameKw, true, 'Past event', 'Name') };
  }
  // The Past event tab: one pasted seating list, one row per person. Guest rows are skipped. A
  // class year written after a name ("Testwood, Avery '27") is dropped.
  function readPastEvent(values, ev) {
    if (!values || values.length < 2) throw new Error('The Past event tab is missing or empty. Paste one past seating list into a tab named Past event, with a Name column (or first and last name columns) and a Table column.');
    var c = columnsOf('Past event', values, ev), names = pastNameColumns(c.headers, ev);
    return dataRows(values).map(function (r) {
      var name = names.name !== undefined ? cellText(r, names.name) : text(cellText(r, names.first) + ' ' + cellText(r, names.last));
      var cell = tableCell(cellText(r, c.idx.Table));
      return { row: r.row, name: name.replace(/\s*['‘’]\d{2}$/, ''), table: cell.table, tableText: cellText(r, c.idx.Table), email: cellText(r, c.idx.Email),
        role: roleOf(cellText(r, c.idx.Role)) || roleOf(cell.rest) };
    }).filter(function (r) { return r.name !== '' && !/^guest\b/i.test(r.name); });
  }
  // SM Seating: a note on row 1, headers below it. The header row is the first with Table and Name.
  function readSeating(values) {
    if (!values || !values.length) throw new Error('There is no SM Seating tab yet. Run Seated Meals > Sort first.');
    var headerRow = -1;
    for (var i = 0; i < Math.min(values.length, 5) && headerRow < 0; i++) {
      var h = values[i].map(norm);
      if (h.indexOf('table') >= 0 && h.indexOf('name') >= 0) headerRow = i;
    }
    if (headerRow < 0) throw new Error('SM Seating has no header row with Table and Name. Run Sort again to rebuild it.');
    var c = columnsOf('SM Seating', values, null, headerRow);
    return dataRows(values, headerRow).map(function (r) {
      var g = function (k) { return cellText(r, c.idx[k]); };
      return { row: r.row, tableText: g('Table'), table: wholeNumber(g('Table')), name: g('Name'), kind: g('Kind'), form: g('Form'), role: g('Role'), email: g('Email'), locked: yes(g('Locked')), why: g('Why') };
    });
  }

  // ---------- The whole workbook ----------

  // Reads every tab Sort and Check again need. tabs maps a tab name to its values (or null).
  function readWorkbook(tabs) {
    var needs = [];
    var ev = readEvent(tabs['Event']);
    var tables = readTables(tabs['Tables'], ev);
    var rules = readRules(tabs['Rules'], ev);
    var st = readStudents(tabs['Students'], ev, needs);
    if (!tabs['Faculty'] || tabs['Faculty'].length < 2) ev.warnings.push('The Faculty tab is missing or empty, so only Faculty list people are known' + (ev.facultyNoAnswer === 'Seat' ? '.' : ' and none is seated.'));
    var fac = readFaculty(tabs['Faculty'], tabs['Faculty list'], ev, needs);
    var model = {
      event: ev, warnings: ev.warnings, needs: needs, tables: tables, rules: rules,
      students: st.students, forms: st.forms, season: st.season, has: st.has, studentHeaders: st.headers,
      adults: fac.adults, hasFacultyList: fac.hasList,
      notAttending: readNotAttending(tabs['Not attending'], ev),
      locks: readLocks(tabs['Locked seats'], ev),
      seatingHistory: readSeatingHistory(tabs['Seating history'], ev),
      waiterHistory: readWaiterHistory(tabs['Waiter history'], ev)
    };
    if (ev.sort === 'Together') model.together = togetherValue(model);
    return model;
  }

  return {
    EVENT_DEFAULTS: EVENT_DEFAULTS, COLUMNS: COLUMNS, RULE_DEFAULTS: RULE_DEFAULTS, FORM_ORDER: FORM_ORDER,
    text: text, norm: norm, isDate: isDate, dateKey: dateKey, splitNames: splitNames, wholeNumber: wholeNumber, sortText: sortText,
    nameWords: nameWords, nameKey: nameKey, matchName: matchName, closestNames: closestNames, findColumn: findColumn, columnsOf: columnsOf, dataRows: dataRows,
    setupDefaults: setupDefaults, readEvent: readEvent, readTables: readTables, readRules: readRules, ruleId: ruleId,
    readStudents: readStudents, readFaculty: readFaculty, readNotAttending: readNotAttending, readLocks: readLocks,
    readSeatingHistory: readSeatingHistory, readWaiterHistory: readWaiterHistory, readPastEvent: readPastEvent,
    readSeating: readSeating, readWorkbook: readWorkbook, roleOf: roleOf
  };
}());
