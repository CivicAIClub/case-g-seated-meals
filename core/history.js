/*
 * Seated Meals: history.
 *
 * What the tool knows about earlier dinners: who sat at which table at the last event (for the
 * repeat rules), how often each student has waited this school year (for fair waiters), and the
 * importer that matches a pasted past seating list to today's students and faculty by email or by
 * name. No Sheets calls here.
 */
var SMHistory = (function () {
  'use strict';

  function sameEvent(row, name, date) { return SMRead.norm(row.event) === SMRead.norm(name) && row.date === date; }

  // The most recent event in Seating history before date: its name, date and each person's table.
  function lastEvent(rows, date) {
    var best = '';
    rows.forEach(function (r) { if (r.date && r.date < date && r.date > best) best = r.date; });
    if (!best) return null;
    var tableById = {}, name = '';
    rows.forEach(function (r) {
      if (r.date !== best || !r.id || isNaN(r.table)) return;
      tableById[r.id] = r.table;
      if (!name) name = r.event;
    });
    return { event: name, date: best, tableById: tableById };
  }

  // The first day of the school year a date falls in (August 1).
  function schoolYearStart(date) {
    var y = +date.slice(0, 4), m = +date.slice(5, 7);
    return (m >= 8 ? y : y - 1) + '-08-01';
  }

  // Waiting before date: times each student waited this school year (both roles count), who waited
  // at the most recent waiting event, and who has ever waited.
  function waiterSummary(rows, date) {
    var since = schoolYearStart(date), count = {}, ever = {}, last = '', lastIds = {}, any = false;
    rows.forEach(function (r) {
      if (!r.id || !r.date || r.date >= date || !SMRead.roleOf(r.role)) return;
      any = true;
      ever[r.id] = true;
      if (r.date >= since) count[r.id] = (count[r.id] || 0) + 1;
      if (r.date > last) last = r.date;
    });
    rows.forEach(function (r) { if (r.id && r.date === last && SMRead.roleOf(r.role)) lastIds[r.id] = true; });
    return { countById: count, ever: ever, lastIds: lastIds, lastDate: last, since: since, any: any };
  }

  function hasEvent(rows, name, date) { return rows.some(function (r) { return sameEvent(r, name, date); }); }

  // A history tab's raw values without one event's rows (header kept), for rewriteHistory_.
  function withoutEvent(tab, values, name, date) {
    if (!values || !values.length) return [];
    var c = SMRead.columnsOf(tab, values, null);
    return [values[0]].concat(values.slice(1).filter(function (row) {
      return !(SMRead.norm(row[c.idx.Event]) === SMRead.norm(name) && SMRead.dateKey(row[c.idx.Date]) === date);
    }));
  }

  // History rows from the working list (SM Seating): every seated student and faculty member, and
  // every waiter and assistant. Guests are not tracked.
  function rowsToSave(seating, name, date) {
    var seats = [], waiters = [];
    seating.forEach(function (r) {
      var kind = SMRead.norm(r.kind);
      if (kind !== 'student' && kind !== 'faculty') return;
      seats.push([name, date, r.email, r.name, r.tableText]);
      var role = SMRead.roleOf(r.role);
      if (kind === 'student' && role) waiters.push([name, date, r.email, r.name, role]);
    });
    return { seats: seats, waiters: waiters };
  }

  // People as matchName expects them.
  function matchable(students, adults) {
    // Plain copies, made once per import, so matchName can keep its name keys on them.
    return {
      students: students.map(function (s) { return { kind: 'Student', id: s.id, email: s.email, name: s.name, shownFirst: s.shownFirst, legalFirst: s.legalFirst, last: s.last }; }),
      adults: adults.map(function (a) { return { kind: 'Faculty', id: a.id, email: a.email, name: a.name, shownFirst: a.shownFirst, legalFirst: a.legalFirst, last: a.last, otherNames: a.otherNames || [] }; })
    };
  }
  function describe(p) { return p.name + (p.email ? ' (' + p.email + ')' : ''); }

  // Matches each Past event row to a student (then a faculty member): by email when there is one,
  // otherwise by name. Rows that match nobody, or more than one person, go to needs with the
  // closest candidates, and nothing is added for them. A row that matches nobody is often someone
  // who has graduated or left, so its advice says so; unmatched counts those rows.
  function matchPastEvent(past, students, adults) {
    var people = matchable(students, adults), byEmail = {}, matched = [], needs = [], seen = {}, unmatched = 0;
    people.students.concat(people.adults).forEach(function (p) { if (p.email && !byEmail[p.email.toLowerCase()]) byEmail[p.email.toLowerCase()] = p; });
    past.forEach(function (r) {
      var p = null, problem = '', nobody = false;
      if (isNaN(r.table)) problem = 'Table "' + r.tableText + '" is not a table number.';
      else if (r.email) {
        p = byEmail[r.email.toLowerCase()] || null;
        if (!p) { nobody = true; problem = 'Nobody in Students or the faculty has the email ' + r.email + '.'; }
      } else {
        var m = SMRead.matchName(r.name, people.students);
        if (!m.match && !m.ambiguous.length) {
          var f = SMRead.matchName(r.name, people.adults);
          if (f.match || f.ambiguous.length) m = f;
          else m.closest = SMRead.closestNames(r.name, people.students.concat(people.adults));
        }
        p = m.match;
        if (m.ambiguous.length) problem = 'Matches more than one person: ' + m.ambiguous.map(describe).join('; ') + '.';
        else if (!p) { nobody = true; problem = 'Matches nobody in Students or the faculty.' + (m.closest.length ? ' Closest: ' + m.closest.map(describe).join('; ') + '.' : ''); }
      }
      if (p && seen[p.id]) { problem = 'Same person as Past event row ' + seen[p.id] + ' (' + p.name + '); only that row was used.'; p = null; }
      if (!p) {
        var advice = nobody ? ' If they\'re still at the school, type their email into this row and run Add a past event to history again. If they graduated or left, ignore this row.'
          : ' Type the right email into this row and run Add a past event to history again.';
        if (nobody) unmatched++;
        needs.push({ section: 'Past event', name: r.name, email: r.email, problem: 'Past event row ' + r.row + ': ' + problem + advice });
        return;
      }
      seen[p.id] = r.row;
      matched.push({ kind: p.kind, id: p.id, email: p.email, name: p.name, table: r.table, role: p.kind === 'Student' ? r.role : '' });
    });
    return { matched: matched, needs: needs, unmatched: unmatched, problems: needs.length - unmatched };
  }

  // History rows for the matched rows of a past event.
  function pastRows(matched, name, date) {
    return {
      seats: matched.filter(function (m) { return m.email; }).map(function (m) { return [name, date, m.email, m.name, m.table]; }),
      waiters: matched.filter(function (m) { return m.email && m.role; }).map(function (m) { return [name, date, m.email, m.name, m.role]; })
    };
  }

  return { lastEvent: lastEvent, waiterSummary: waiterSummary, schoolYearStart: schoolYearStart, hasEvent: hasEvent, withoutEvent: withoutEvent,
    rowsToSave: rowsToSave, matchPastEvent: matchPastEvent, pastRows: pastRows };
}());
