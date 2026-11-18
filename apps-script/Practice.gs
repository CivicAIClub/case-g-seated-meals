// Generated from core/practice.js by npm run bundle. Edit core/practice.js, then rebuild.
/*
 * Seated Meals: practice data.
 *
 * Makes an invented school with the same layout as the real files: Students in the exact shape of
 * Mr. Sheehan's export (same eleven headers, typo included), the faculty form's responses, a
 * Faculty list, absences, two past dinners (one already in history, one pasted into Past event).
 * Everyone is made up ("Avery Testwood"), and emails end in @example.org. A fixed seed makes it
 * identical every time, so the tests can count on it. Nothing is tuned to force an outcome; the
 * planted cases are listed in planted.
 */
var SMPractice = (function () {
  'use strict';

  var STUDENT_HEADERS = ['FirstName', 'Nickname', 'LastName', 'Email', 'YOG', 'SchoolYear', 'TeamSeason', 'TeanName', 'AdvisorGroup', 'Gender', 'BoardingDay'];
  var FACULTY_HEADERS = ['Timestamp', 'Email Address', 'Your name', 'Will you attend this seated meal?',
    'Will a spouse, partner or child join you? If so, who?', 'How many seats should we save for your guests?',
    "Up to three colleagues you'd enjoy sitting with",
    'Are you new to Pomfret this year, or would you be glad to sit with a colleague who is?'];
  var NEW_ANSWER = "I'm new to Pomfret this year", MENTOR_ANSWER = "I'd be glad to sit with a new colleague", NEITHER = 'Neither';

  var FIRSTS = ['Avery', 'Blake', 'Casey', 'Dana', 'Emery', 'Finley', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Logan', 'Morgan', 'Noel', 'Oakley',
    'Parker', 'Quinn', 'Reese', 'Sage', 'Tatum', 'Umber', 'Vale', 'Wren', 'Xen', 'Yael', 'Zuri', 'Arden', 'Bellamy', 'Cove', 'Darby', 'Ellis',
    'Fable', 'Greer', 'Hollis', 'Ione', 'Jessamy', 'Keegan', 'Larkin', 'Marlow', 'Nico', 'Onyx', 'Perry', 'Rowan', 'Shiloh', 'Tobin', 'Uri',
    'Vesper', 'Winslow', 'Yardley', 'Zephyr', 'Ainsley', 'Briar', 'Cypress', 'Dell', 'Everly', 'Fennel', 'Gale', 'Hayden', 'Isle', 'Jory'];
  var NICKS = ['Ace', 'Bee', 'Cricket', 'Dot', 'Echo', 'Fizz', 'Gus', 'Hap', 'Izzy', 'Jinx', 'Kit', 'Lulu', 'Moxie', 'Nibs', 'Ollie', 'Pip',
    'Rook', 'Scout', 'Taz', 'Voodle', 'Wiz', 'Zig', 'Bix', 'Cap', 'Dex', 'Fig', 'Gem', 'Hux', 'Jaz', 'Lux'];
  var LAST_A = ['Test', 'Sample', 'Mock', 'Demo', 'Practice', 'Pretend', 'Example', 'Draft', 'Trial', 'Dummy'];
  var LAST_B = ['wood', 'field', 'stone', 'brook', 'ridge', 'ton', 'ley', 'worth', 'ford', 'dale', 'hill', 'more'];
  var FAC_A = ['Proto', 'Sketch', 'Model', 'Pilot', 'Stand', 'Placeholder', 'Fill'];
  var FAC_B = ['berry', 'castle', 'gate', 'haven', 'lane', 'mere', 'port', 'shaw', 'wick', 'yard', 'bury', 'combe', 'holt', 'stead'];
  var WORDS = ['Birch', 'Cedar', 'Maple', 'Willow', 'Heron', 'Lantern', 'Copper', 'Harbor', 'Meadow', 'Summit', 'Ember', 'Juniper', 'Falcon', 'Thistle', 'Quarry', 'Orchard', 'Pebble'];
  var TEAMS = ['Soccer - Blue', 'Soccer - Gold', 'Soccer - Green', 'Field Sport - Level 1', 'Field Sport - Level 2', 'Running - Long', 'Running - Short',
    'Rowing - Novice', 'Rowing - Open', 'Court Sport - Level 1', 'Court Sport - Level 2', 'Riding - Barn', 'Fitness - Morning', 'Fitness - Evening',
    'Climbing - Wall', 'Dance - Studio', 'Stage Crew', 'Yearbook Practice', 'Garden Club', 'Robot Lab', 'Community Hours'];
  var TEAM_SIZES = [28, 26, 25, 24, 22, 22, 20, 20, 18, 18, 17, 16, 15, 15, 14, 13, 12, 10, 7, 5, 3];
  var WINTER_TEAMS = ['Ice Sport - Level 1', 'Court Sport - Winter', 'Snow Sport - Hill', 'Swim - Pool'];
  // YOG counts in about the real proportions (60 to 100 a class).
  var YOG_COUNTS = [[2027, 95], [2028, 92], [2029, 88], [2030, 75]];
  // Advisory sizes: most 6 or 7, eight of 10 or 11, a few of 4 or 5 (51 advisories, 350 students).
  var ADVISORY_SIZES = [4, 4, 5, 5, 5].concat(rep(6, 23), rep(7, 15), [10, 10, 10, 10, 11, 11, 11, 11]);
  var PAST_A = { name: 'Practice dinner A', date: '2026-09-22' };
  var PAST_B = { name: 'Practice dinner B', date: '2026-11-10' };

  function rep(v, n) { var out = []; for (var i = 0; i < n; i++) out.push(v); return out; }
  // mulberry32: a small seeded generator, so the practice data is the same on every run.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function make() {
    var rand = mulberry32(20261215);
    function int(n) { return Math.floor(rand() * n); }
    function pick(list) { return list[int(list.length)]; }
    function shuffled(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = int(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    var usedEmails = {};
    function emailFor(first, last) {
      var base = (first + '.' + last).toLowerCase().replace(/[^a-z.]/g, ''), e = base, n = 2;
      while (usedEmails[e]) e = base + (n++);
      usedEmails[e] = true;
      return e + '@example.org';
    }

    // ----- Students -----
    var students = [], usedNames = {};
    YOG_COUNTS.forEach(function (yc) {
      for (var i = 0; i < yc[1]; i++) {
        var first, last, nick;
        do { first = pick(FIRSTS); last = pick(LAST_A) + pick(LAST_B); } while (usedNames[first + ' ' + last]);
        nick = rand() < 1 / 3 ? pick(NICKS) : first;
        if (usedNames[nick + ' ' + last]) nick = first;
        usedNames[first + ' ' + last] = usedNames[nick + ' ' + last] = true;
        var g = rand();
        students.push({ first: first, nick: nick, last: last, email: emailFor(first, last), yog: yc[0],
          gender: g < 0.48 ? 'Female' : g < 0.96 ? 'Male' : g < 0.98 ? 'Nonbinary' : '', bd: rand() < 0.86 ? 'B' : 'D' });
      }
    });
    var advisories = [], usedLabels = {};
    while (advisories.length < ADVISORY_SIZES.length) {
      var words = 1 + int(4), label = [];
      for (var w = 0; w < words; w++) label.push(pick(WORDS));
      label = label.join(' ');
      if (!usedLabels[label] && !/(\b\w+\b).*\b\1\b/.test(label)) { usedLabels[label] = true; advisories.push(label); }
    }
    var order = shuffled(students), at = 0;
    ADVISORY_SIZES.forEach(function (size, i) { for (var k = 0; k < size; k++) order[at++].advisory = advisories[i]; });
    order = shuffled(students); at = 0;
    TEAM_SIZES.forEach(function (size, i) { for (var k = 0; k < size; k++) order[at++].team = TEAMS[i]; });

    students.sort(function (a, b) { return a.last < b.last ? -1 : a.last > b.last ? 1 : a.first < b.first ? -1 : a.first > b.first ? 1 : 0; });
    function studentRow(s, season, team) { return [s.first, s.nick, s.last, s.email, String(s.yog), '2026 - 2027', season, team, s.advisory, s.gender, s.bd]; }
    // Planted: one student with no email, and one Fall row repeated (a duplicate email).
    var noEmail = students[int(students.length)];
    var rows = [STUDENT_HEADERS];
    students.forEach(function (s) { rows.push(studentRow(s, 'Fall', s.team)); });
    noEmail.email = '';
    rows.forEach(function (r) { if (r[0] === noEmail.first && r[2] === noEmail.last) r[3] = ''; });
    var dup = students[int(students.length)];
    while (dup === noEmail) dup = students[int(students.length)];
    rows.push(studentRow(dup, 'Fall', dup.team));
    // Winter rows for about 40 students, so the season filter has something to set aside.
    var winter = shuffled(students.filter(function (s) { return s !== noEmail; })).slice(0, 40);
    winter.forEach(function (s) { rows.push(studentRow(s, 'Winter', pick(WINTER_TEAMS))); });

    // ----- Faculty -----
    var faculty = [], facNames = {};
    for (var f = 0; f < 92; f++) {
      var ff, fl;
      do { ff = pick(FIRSTS); fl = pick(FAC_A) + pick(FAC_B); } while (facNames[ff + ' ' + fl] || facNames['last:' + fl]);
      facNames[ff + ' ' + fl] = facNames['last:' + fl] = true;
      faculty.push({ name: ff + ' ' + fl, first: ff, last: fl });
    }
    // Planted: three couples who share a surname.
    var couples = [[0, 1], [2, 3], [4, 5]];
    couples.forEach(function (c) {
      var a = faculty[c[0]], b = faculty[c[1]], first;
      do { first = pick(FIRSTS); } while (first === a.first);
      b.first = first; b.last = a.last; b.name = first + ' ' + a.last;
    });
    faculty.forEach(function (p) { p.email = emailFor(p.first, p.last); });
    var advisorOrder = shuffled(faculty.slice());
    advisorOrder.forEach(function (p, i) { p.group = i < advisories.length ? advisories[i] : ''; });
    var listRows = [['Name', 'Email', 'AdvisorGroup']].concat(faculty.map(function (p) { return [p.name, p.email, p.group]; }));

    // Who answers what. Indexes after the couples are handed out in this order.
    var rest = shuffled(faculty.slice(6));
    var noAnswer = rest.slice(0, 6), sayNo = rest.slice(6, 14), guests = rest.slice(14, 18), newcomers = rest.slice(18, 22),
      mentors = rest.slice(22, 28), triangle = rest.slice(28, 31), askers = rest.slice(31, 35), twice = rest[35];
    var answers = {};
    faculty.forEach(function (p) { answers[p.email] = { attend: 'Yes', guests: '', seats: '', colleagues: '', newText: NEITHER }; });
    sayNo.forEach(function (p) { answers[p.email] = { attend: 'No', guests: '', seats: '', colleagues: '', newText: '' }; });
    couples.forEach(function (c, i) {
      var a = faculty[c[0]], b = faculty[c[1]];
      answers[a.email].guests = b.name + (i === 2 ? ' and Sprout ' + a.last : '');
      answers[a.email].seats = i === 2 ? '2' : '1';
      answers[b.email].guests = a.name;
      answers[b.email].seats = '0';
    });
    var guestPlans = [['Robin Visitorly', '1'], ['Pat Guestwell & Lee Guestwell', '2'], ['Sam Plusone', '1'], ['Kim Guestfield, Ari Guestfield', '1']];
    guests.forEach(function (p, i) { answers[p.email].guests = guestPlans[i][0]; answers[p.email].seats = guestPlans[i][1]; });
    newcomers.forEach(function (p) { answers[p.email].newText = NEW_ANSWER; });
    mentors.forEach(function (p) { answers[p.email].newText = MENTOR_ANSWER; });
    triangle.forEach(function (p, i) {
      answers[p.email].colleagues = [triangle[(i + 1) % 3].name, triangle[(i + 2) % 3].name].join(', ');
    });
    answers[askers[0].email].colleagues = 'Morgan Notonlist';
    answers[askers[1].email].colleagues = askers[2].name;
    answers[askers[3].email].colleagues = askers[1].name + ' and ' + mentors[0].name;
    var formRows = [FACULTY_HEADERS], minute = 0;
    function stamp() { minute += 7 + int(50); var d = 2 + Math.floor(minute / 600), m = minute % 600; return '11/' + (d < 10 ? '0' : '') + d + '/2026 ' + (8 + Math.floor(m / 60)) + ':' + ((m % 60) < 10 ? '0' : '') + (m % 60) + ':00'; }
    function formRow(p, a) { return [stamp(), p.email, p.name, a.attend, a.guests, a.seats, a.colleagues, a.newText]; }
    shuffled(faculty).forEach(function (p) {
      if (noAnswer.indexOf(p) >= 0) return;
      if (p === twice) formRows.push(formRow(p, { attend: 'No', guests: '', seats: '', colleagues: '', newText: '' }));
      formRows.push(formRow(p, answers[p.email]));
    });

    // ----- Not attending: about 25 students -----
    var away = shuffled(students.filter(function (s) { return s.email; })).slice(0, 25);
    var reasons = ['Away game', 'Excused', 'Family weekend', 'Health center', 'Off campus with a team'];
    var notAttending = [['Email', 'Name', 'Why']].concat(away.map(function (s) { return [s.email, s.nick + ' ' + s.last, pick(reasons)]; }));

    // ----- Two past dinners, seated at random, so repeats and waiting have history -----
    function pastDinner(tables) {
      var seats = [], waiters = [], kids = shuffled(students), adults = shuffled(faculty);
      kids.forEach(function (s, i) { seats.push({ p: s, kind: 'Student', table: 1 + (i % tables) }); });
      adults.forEach(function (p, i) { seats.push({ p: p, kind: 'Faculty', table: 1 + (i % tables) }); });
      for (var t = 1; t <= tables; t++) {
        var at = seats.filter(function (x) { return x.table === t && x.kind === 'Student' && x.p.email; });
        var pickTwo = shuffled(at).slice(0, 2);
        if (pickTwo[0]) waiters.push({ p: pickTwo[0].p, role: 'Waiter' });
        if (pickTwo[1]) waiters.push({ p: pickTwo[1].p, role: 'Assistant' });
      }
      return { seats: seats, waiters: waiters };
    }
    var a = pastDinner(42), b = pastDinner(44);
    function shown(p) { return p.nick ? p.nick + ' ' + p.last : p.name; }
    var seatingHistory = [['Event', 'Date', 'Email', 'Name', 'Table']].concat(a.seats.filter(function (x) { return x.p.email; }).map(function (x) { return [PAST_A.name, PAST_A.date, x.p.email, shown(x.p), x.table]; }));
    var waiterHistory = [['Event', 'Date', 'Email', 'Name', 'Role']].concat(a.waiters.map(function (x) { return [PAST_A.name, PAST_A.date, x.p.email, shown(x.p), x.role]; }));

    // Past event: dinner B by name, as a hand-made list would be. Some names drift on purpose.
    var roleOf = {};
    b.waiters.forEach(function (x) { roleOf[x.p.email] = x.role; });
    var drift = { legal: [], swapped: [], initial: [], misspelled: null, withEmail: [] };
    var kidSeats = b.seats.filter(function (x) { return x.kind === 'Student' && x.p !== noEmail; });
    var nickKids = shuffled(kidSeats.filter(function (x) { return x.p.nick !== x.p.first; }));
    nickKids.slice(0, 6).forEach(function (x) { drift.legal.push(x.p); });
    var others = shuffled(kidSeats.filter(function (x) { return drift.legal.indexOf(x.p) < 0; }));
    others.slice(0, 5).forEach(function (x) { drift.swapped.push(x.p); });
    others.slice(5, 8).forEach(function (x) { drift.initial.push(x.p); });
    drift.misspelled = others[8].p;
    others.slice(9, 40).forEach(function (x) { drift.withEmail.push(x.p); });
    var pastRows = [['Name', 'Table', 'Role', 'Email']];
    b.seats.forEach(function (x) {
      var p = x.p, name = shown(p), email = '';
      if (x.kind === 'Student') {
        if (p === noEmail) return;
        if (drift.legal.indexOf(p) >= 0) name = p.first + ' ' + p.last;
        else if (drift.swapped.indexOf(p) >= 0) name = p.last + ', ' + p.nick;
        else if (drift.initial.indexOf(p) >= 0) name = p.nick.charAt(0) + '. ' + p.last;
        else if (p === drift.misspelled) name = p.nick + ' ' + p.last.slice(0, -2) + p.last.slice(-1);
        if (drift.withEmail.indexOf(p) >= 0) email = p.email;
      }
      pastRows.push([name, x.table, roleOf[p.email] || '', email]);
    });
    pastRows.push(['Quinn Nobodyhere', 7, '', '']);

    return {
      tabs: { 'Students': rows, 'Faculty': formRows, 'Faculty list': listRows, 'Not attending': notAttending, 'Past event': pastRows },
      history: { 'Seating history': seatingHistory, 'Waiter history': waiterHistory },
      event: { 'Season': 'Fall 2026 - 2027' },
      pastEvent: PAST_B,
      planted: {
        noEmailStudent: noEmail.first + ' ' + noEmail.last, duplicateEmail: dup.email, winterRows: winter.length, notAttending: away.length,
        facultySayNo: sayNo.map(function (p) { return p.email; }), facultyNoAnswer: noAnswer.map(function (p) { return p.email; }),
        couples: couples.map(function (c) { return [faculty[c[0]].email, faculty[c[1]].email]; }),
        guestHosts: guests.map(function (p) { return p.email; }), newFaculty: newcomers.map(function (p) { return p.email; }),
        mentors: mentors.map(function (p) { return p.email; }), triangle: triangle.map(function (p) { return p.email; }),
        unknownColleague: 'Morgan Notonlist', answeredTwice: twice.email,
        pastMisspelled: drift.misspelled.email, pastNobody: 'Quinn Nobodyhere',
        pastLegal: drift.legal.map(function (p) { return p.email; }), pastSwapped: drift.swapped.map(function (p) { return p.email; }),
        pastInitial: drift.initial.map(function (p) { return p.email; })
      }
    };
  }

  return { make: make, mulberry32: mulberry32, STUDENT_HEADERS: STUDENT_HEADERS, FACULTY_HEADERS: FACULTY_HEADERS, PAST_A: PAST_A, PAST_B: PAST_B };
}());
