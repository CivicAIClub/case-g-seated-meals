/*
 * Seated Meals: seating and checking.
 *
 * Sort, steps 1 to 8 of the spec: who's coming, locked seats, faculty, seats left for students,
 * the Mixed or Together deal, better seats by swapping, and waiters. Then the check that every
 * hard limit and rule holds, which Check again also uses on a hand-edited list. No Sheets calls.
 *
 * Ties are never broken by the alphabet or by chance: every person gets a fixed shuffle key, the
 * FNV-1a hash of the Seed and their ID (the same idea as case-f-project-pomfret's tie order). Same
 * input and same Seed, same seating.
 */
var SMSeat = (function () {
  'use strict';

  // FNV-1a, 32 bits: a fast, fixed hash. Used for the shuffle keys and the rotating start table.
  function fnv(s) {
    s = String(s);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function byKey(a, b) { return a.key - b.key || cmp(a.id, b.id); }
  function sum(list, f) { var n = 0; list.forEach(function (x) { n += f(x); }); return n; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function names(list) { return list.map(function (p) { return p.name; }).join(', '); }

  // ---------- Step 1: who's coming, and everything Sort and Check need to know ----------

  function prepare(model) {
    var ev = model.event, ctx = { model: model, ev: ev, needs: model.needs.slice(), notes: [] };

    ctx.tables = model.tables.filter(function (t) { return t.inUse; }).map(function (t) { return { num: t.num, row: t.row, seats: t.seats }; });
    if (!ctx.tables.length) throw new Error('No table is In use on the Tables tab. Set In use to Yes for the tables set for this dinner.');
    ctx.tableByNum = {};
    var start = fnv('start|' + ev.seed) % ctx.tables.length;
    ctx.tables.forEach(function (t, i) { t.index = i; t.rot = (i - start + ctx.tables.length) % ctx.tables.length; ctx.tableByNum[t.num] = t; });

    // Not attending: matched by email, or by name when the row has no email.
    var outById = {}, outByName = {}, used = {};
    model.notAttending.forEach(function (r) {
      if (r.email) outById[r.email.toLowerCase()] = r;
      else if (r.name) outByName[SMRead.nameKey(r.name)] = r;
    });
    function absent(p) {
      var r = outById[p.id] || outByName[SMRead.nameKey(p.name)] || outByName[SMRead.nameKey(p.legalFirst + ' ' + p.last)];
      if (r) used[r.row] = true;
      return !!r;
    }
    ctx.allStudentById = {}; ctx.allAdultById = {};
    model.students.forEach(function (s) { ctx.allStudentById[s.id] = s; });
    model.adults.forEach(function (a) { ctx.allAdultById[a.id] = a; });
    ctx.students = model.students.filter(function (s) { return !absent(s); });
    ctx.adults = model.adults.filter(function (a) { return a.attending && !absent(a); });
    model.notAttending.forEach(function (r) {
      if (!used[r.row]) ctx.needs.push({ section: 'Data problems', name: r.name, email: r.email, problem: 'Not attending row ' + r.row + ' matches nobody in Students or the faculty who are coming.' });
    });

    // History: the last event's tables, and who has waited.
    ctx.last = SMHistory.lastEvent(model.seatingHistory, ev.date);
    ctx.waiting = SMHistory.waiterSummary(model.waiterHistory, ev.date);

    // Each person's shuffle key and the facts the rules use.
    ctx.studentById = {}; ctx.adultById = {};
    var together = model.together;
    ctx.students.forEach(function (s) {
      s.kind = 'Student'; s.key = fnv(ev.seed + '|' + s.id);
      s.lastTable = ctx.last && ctx.last.tableById[s.id] !== undefined ? ctx.last.tableById[s.id] : null;
      s.waited = !!ctx.waiting.ever[s.id];
      var g = SMRead.norm(s.gender);
      s.genderKey = g === 'female' || g === 'f' ? 'Female' : g === 'male' || g === 'm' ? 'Male' : '';
      s.bd = s.boarding === 'Boarding' ? 'B' : s.boarding === 'Day' ? 'D' : '';
      s.group = together ? (SMRead.text(together.get(s)) || 'No ' + together.label) : '';
      s.role = ''; s.locked = false; s.why = '';
      ctx.studentById[s.id] = s;
    });
    ctx.adults.forEach(function (a) {
      a.kind = 'Faculty'; a.key = fnv(ev.seed + '|' + a.id);
      a.lastTable = ctx.last && ctx.last.tableById[a.id] !== undefined ? ctx.last.tableById[a.id] : null;
      ctx.adultById[a.id] = a;
    });

    // Units: a household (faculty who named each other) is one unit; guests travel with their host.
    var parent = {};
    function find(id) { while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; } return id; }
    ctx.adults.forEach(function (a) { parent[a.id] = a.id; });
    ctx.adults.forEach(function (a) { a.householdIds.forEach(function (h) { if (parent[h] !== undefined) parent[find(h)] = find(a.id); }); });
    var unitByRoot = {};
    ctx.units = []; ctx.unitOf = {}; ctx.unitById = {};
    ctx.adults.slice().sort(byKey).forEach(function (a) {
      var root = find(a.id), u = unitByRoot[root];
      if (!u) { u = unitByRoot[root] = { id: 'unit:' + a.id, key: a.key, members: [], guests: [], wants: {}, asked: {}, sameName: {}, table: null, locked: false, why: '' }; ctx.units.push(u); ctx.unitById[u.id] = u; }
      u.members.push(a);
      ctx.unitOf[a.id] = u;
    });
    ctx.units.forEach(function (u) {
      u.members.forEach(function (m) {
        m.guestNames.forEach(function (n) { u.guests.push({ name: n, host: m, named: true }); });
        for (var k = m.guestNames.length; k < m.guestSeats; k++) u.guests.push({ name: 'Guest of ' + m.name, host: m, named: false });
      });
      u.seats = u.members.length + u.guests.length;
      u.isNew = u.members.some(function (m) { return m.isNew; });
      u.isMentor = !u.isNew && u.members.some(function (m) { return m.isMentor; });
      u.name = names(u.members);
    });
    // Colleague requests link units both ways.
    ctx.adults.forEach(function (a) {
      a.colleagueIds.forEach(function (id) {
        var u = ctx.unitOf[a.id], v = ctx.unitOf[id];
        if (!v || u === v) return;
        u.wants[v.id] = true; v.wants[u.id] = true;
        u.asked[v.id] = true; v.asked[u.id] = true;
      });
    });
    pairSameLastNames(ctx);
    ctx.totalMembers = ctx.adults.length;

    // Rules: which are in force for this event, in rank order.
    ctx.rules = model.rules.map(function (r) {
      var out = { id: r.id, text: r.text, rank: r.position, value: r.value, on: r.on, status: 'active', reason: '' };
      function notChecked(why) { out.status = 'notChecked'; out.reason = why; }
      if (!r.on) { out.status = 'off'; out.reason = r.missing ? 'Not on the Rules tab, so off.' : 'Rule is off.'; }
      else if ((r.id === 'forms' || r.id === 'perForm') && ev.sort !== 'Mixed') notChecked('Only used by the Mixed sort.');
      else if (r.id === 'neighbors' && ev.sort !== 'Together') notChecked('Only used by the Together sort.');
      else if ((r.id === 'tablemates' || r.id === 'sameStudents' || r.id === 'sameFaculty') && !ctx.last) notChecked('No earlier event in Seating history yet.');
      else if (r.id === 'waited' && !ctx.waiting.any) notChecked('No waiting in Waiter history yet.');
      else if (r.id === 'gender' && !model.has.Gender) notChecked('Not checked: no Gender column.');
      else if (r.id === 'boarding' && !model.has['Boarding or day']) notChecked('Not checked: no BoardingDay column.');
      return out;
    });
    ctx.active = ctx.rules.filter(function (r) { return r.status === 'active' && r.id !== 'neighbors'; });
    ctx.isActive = {};
    ctx.rules.forEach(function (r) { if (r.status === 'active') ctx.isActive[r.id] = true; });

    // Locked seats: each row resolved to an attending person and a table in use.
    ctx.locks = [];
    var lockedIds = {};
    model.locks.forEach(function (L) {
      var problem = '', p = null, num = SMRead.wholeNumber(L.table);
      if (L.email) p = ctx.studentById[L.email.toLowerCase()] || ctx.adultById[L.email.toLowerCase()] || null;
      else if (L.name) {
        var m = SMRead.matchName(L.name, ctx.students.concat(ctx.adults));
        p = m.match;
        if (m.ambiguous.length) problem = '"' + L.name + '" matches more than one person (' + names(m.ambiguous) + '). Add the email.';
      }
      if (!p && !problem) problem = (L.email || L.name || 'This row') + ' is not someone who is coming.';
      else if (!ctx.tableByNum[num]) problem = 'Table "' + L.table + '" is not in use.';
      else if (lockedIds[p.id]) problem = (p.name) + ' is locked twice; the first row was used.';
      if (problem) { ctx.needs.push({ section: 'Lock problems', name: L.name || (p && p.name) || '', email: L.email, problem: 'Locked seats row ' + L.row + ': ' + problem + ' This row was skipped.' }); return; }
      lockedIds[p.id] = true;
      ctx.locks.push({ row: L.row, person: p, table: num, why: L.why });
    });
    return ctx;
  }

  // Faculty who are both coming and share a last name, but didn't name each other, are asked to
  // sit together the way a colleague request works: together when a table has room, not a hard
  // limit. Mr. Gibbs always seats same-surname faculty together.
  function pairSameLastNames(ctx) {
    var byLast = {}, order = [];
    ctx.adults.forEach(function (a) {
      var k = SMRead.nameKey(a.last);
      if (!k) return;
      if (!byLast[k]) { byLast[k] = []; order.push(k); }
      byLast[k].push(a);
    });
    order.forEach(function (k) {
      var list = byLast[k];
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var u = ctx.unitOf[list[i].id], v = ctx.unitOf[list[j].id];
          if (u === v) continue;
          u.wants[v.id] = true; v.wants[u.id] = true;
          u.sameName[v.id] = true; v.sameName[u.id] = true;
        }
      }
    });
  }

  // ---------- The board: who sits where, with running counts for the rules ----------

  // Keeps per-table counts in memory and updates them on every add and remove, so a swap is cheap
  // to try and undo instead of recounting the room.
  function Board(ctx) {
    var self = this;
    this.ctx = ctx; this.t = {}; this.at = {};
    ctx.tables.forEach(function (tb) {
      self.t[tb.num] = { num: tb.num, seats: tb.seats, used: 0, adults: 0, students: 0, form: {}, last: {}, pairs: 0, waited: 0, female: 0, male: 0, B: 0, D: 0, same: 0, sameAdults: 0 };
    });
  }
  // Adds (sign 1) or removes (sign -1) one student or faculty member at a table.
  Board.prototype.person = function (p, num, sign) {
    var t = this.t[num];
    t.used += sign;
    if (p.kind === 'Student') {
      t.students += sign;
      t.form[p.form] = (t.form[p.form] || 0) + sign;
      if (p.waited) t.waited += sign;
      if (p.genderKey === 'Female') t.female += sign; else if (p.genderKey === 'Male') t.male += sign;
      if (p.bd) t[p.bd] += sign;
      if (p.lastTable === num) t.same += sign;
    } else {
      t.adults += sign;
      if (p.lastTable === num) t.sameAdults += sign;
    }
    // Pairs of people who also shared a table last time: adding someone pairs them with everyone
    // here who had their old table.
    if (p.lastTable !== null && p.lastTable !== undefined) {
      if (sign > 0) { t.pairs += t.last[p.lastTable] || 0; t.last[p.lastTable] = (t.last[p.lastTable] || 0) + 1; }
      else { t.last[p.lastTable]--; t.pairs -= t.last[p.lastTable]; }
    }
    if (sign > 0) this.at[p.id] = num; else delete this.at[p.id];
  };
  Board.prototype.addUnit = function (u, num) {
    var self = this;
    u.members.forEach(function (m) { self.person(m, num, 1); });
    this.t[num].used += u.guests.length;
    u.table = num;
  };
  Board.prototype.removeUnit = function (u) {
    var self = this, num = u.table;
    u.members.forEach(function (m) { self.person(m, num, -1); });
    this.t[num].used -= u.guests.length;
    u.table = null;
  };
  Board.prototype.room = function (num) { var t = this.t[num]; return t.seats - t.used; };

  function distinctForms(t) { var d = 0; for (var f in t.form) if (t.form[f] > 0) d++; return d; }
  // How many times one table breaks each rule in force, in rank order. Rule 5 (neighbors) is
  // about whole groups, so it is checked separately.
  function scoreTable(t, active) {
    var out = [];
    for (var i = 0; i < active.length; i++) {
      var r = active[i], n = 0;
      if (r.id === 'forms') n = t.students > 0 ? Math.max(0, r.value - distinctForms(t)) : 0;
      else if (r.id === 'perForm') { for (var f in t.form) if (t.form[f] > r.value) n += t.form[f] - r.value; }
      else if (r.id === 'tablemates') n = t.pairs;
      else if (r.id === 'waited') n = t.students > 0 && t.waited === 0 ? 1 : 0;
      else if (r.id === 'gender') n = (t.female === 1 ? 1 : 0) + (t.male === 1 ? 1 : 0);
      else if (r.id === 'boarding') n = t.B + t.D >= 2 && (t.B === 0 || t.D === 0) ? 1 : 0;
      else if (r.id === 'sameStudents') n = t.same;
      else if (r.id === 'sameFaculty') n = t.sameAdults;
      out.push(n);
    }
    return out;
  }
  function add(a, b) { return a.map(function (x, i) { return x + b[i]; }); }
  function allZero(a) { for (var i = 0; i < a.length; i++) if (a[i]) return false; return true; }
  // The rank position of the first rule that got better, or -1 if the change is not better by
  // rank (the highest-ranked rule decides; only a tie goes on to the next).
  function improvedAt(before, after) {
    for (var i = 0; i < before.length; i++) {
      if (after[i] < before[i]) return i;
      if (after[i] > before[i]) return -1;
    }
    return -1;
  }

  // ---------- Step 2: locked seats ----------

  function placeLocks(ctx, board) {
    ctx.lockTargets = {};
    ctx.locks.forEach(function (L) {
      var p = L.person, why = 'Locked: ' + (L.why || 'in Locked seats'), problem = '';
      if (p.kind === 'Student') {
        if (board.room(L.table) < 1) problem = 'table ' + L.table + ' is already full';
        else { board.person(p, L.table, 1); p.locked = true; p.why = why; }
      } else {
        var u = ctx.unitOf[p.id];
        if (u.table !== null && u.table !== L.table) problem = 'their household is already locked to table ' + u.table;
        else if (u.table === null && board.room(L.table) < u.seats) problem = 'table ' + L.table + ' has no room for ' + plural(u.seats, 'seat');
        else if (u.table === null) { board.addUnit(u, L.table); u.locked = true; u.why = why; }
      }
      if (problem) ctx.needs.push({ section: 'Lock problems', name: p.name, email: p.email, problem: 'Locked seats row ' + L.row + ': ' + problem + ', so this lock was skipped.' });
      else ctx.lockTargets[p.id] = L.table;
    });
  }

  // ---------- Step 3: faculty ----------

  function couldNotSeat(ctx, p, why) {
    ctx.needs.push({ section: 'Could not seat', name: p.name, email: p.email || '', problem: why });
  }

  // Spreads adult units so each table gets close to Adults per table, filling tables evenly:
  // households first, then new faculty each with a mentor, then colleagues who asked for each
  // other, then everyone else in shuffle order.
  function seatAdults(ctx, board, units) {
    var T = ctx.tables.length, cap = Math.max(ctx.ev.adultsPerTable, Math.ceil(ctx.totalMembers / T));
    var remaining = sum(units.filter(function (u) { return u.table === null; }), function (u) { return u.members.length; });
    function place(u, num, why) { board.addUnit(u, num); remaining -= u.members.length; if (!u.why) u.why = why; }
    function emptyTables() { return ctx.tables.filter(function (tb) { return board.t[tb.num].adults === 0; }).length; }
    // Tables this unit may go to: room for all its seats, under the adult cap if possible, and an
    // empty table when the adults left are only just enough to give every table one.
    function candidates(u, extraSeats) {
      var list = ctx.tables.filter(function (tb) { return board.room(tb.num) >= u.seats + (extraSeats || 0); });
      var underCap = list.filter(function (tb) { return board.t[tb.num].adults + u.members.length <= cap; });
      if (underCap.length) list = underCap;
      var empty = emptyTables();
      if (empty > 0 && remaining - u.members.length < empty) {
        var e = list.filter(function (tb) { return board.t[tb.num].adults === 0; });
        if (e.length) list = e;
      }
      return list;
    }
    function friendsAt(u, num) { var n = 0; for (var id in u.wants) if (ctx.unitById[id].table === num) n++; return n; }
    function best(u, list) {
      var sameRule = ctx.isActive.sameFaculty;
      function key(tb) {
        var t = board.t[tb.num];
        return [-friendsAt(u, tb.num), sameRule && u.members.some(function (m) { return m.lastTable === tb.num; }) ? 1 : 0, t.adults, t.used, tb.rot];
      }
      var bestTb = null, bestKey = null;
      list.forEach(function (tb) {
        var k = key(tb);
        if (!bestKey || improvedAt(bestKey, k) >= 0) { bestTb = tb; bestKey = k; }
      });
      return bestTb;
    }
    function seat(u, why, list) {
      list = list || candidates(u);
      if (!list.length) { couldNotSeat(ctx, u.members[0], 'No table had ' + plural(u.seats, 'free seat') + ' for ' + u.name + (u.guests.length ? ' and their guests' : '') + '.'); return false; }
      place(u, best(u, list).num, why);
      return true;
    }
    function mentorAt(num) { return ctx.units.some(function (u) { return u.isMentor && u.table === num; }); }
    var pending = units.filter(function (u) { return u.table === null; }).sort(byKey);

    pending.filter(function (u) { return u.members.length > 1; }).forEach(function (u) { seat(u, 'Household'); });
    pending.filter(function (u) { return u.isNew; }).forEach(function (u) {
      if (u.table === null) {
        var withMentor = candidates(u).filter(function (tb) { return mentorAt(tb.num); });
        if (!seat(u, 'New faculty, seated with a mentor', withMentor.length ? withMentor : null)) return;
      }
      if (mentorAt(u.table)) return;
      var mentor = pending.filter(function (m) { return m.isMentor && m.table === null && board.room(u.table) >= m.seats; })[0];
      if (mentor) place(mentor, u.table, 'Mentor for ' + u.name);
      else ctx.notes.push('New faculty member ' + u.name + ' has no mentor at table ' + u.table + ': no mentor had a free seat there.');
    });
    pending.filter(function (u) { return u.table === null && Object.keys(u.wants).length; }).forEach(function (u) { seat(u, 'Spread across tables'); });
    pending.filter(function (u) { return u.table === null; }).forEach(function (u) { seat(u, 'Spread across tables'); });

    // A table left without an adult takes one from a table with two or more, when someone can move.
    // Someone sitting with a colleague they asked for (or share a last name with) moves last.
    ctx.tables.forEach(function (tb) {
      if (board.t[tb.num].adults > 0) return;
      var donor = units.filter(function (u) {
        return u.table !== null && !u.locked && !u.isNew && !u.isMentor && board.t[u.table].adults - u.members.length >= 1 && board.room(tb.num) >= u.seats;
      }).sort(function (a, b) { return friendsAt(a, a.table) - friendsAt(b, b.table) || byKey(a, b); })[0];
      if (donor) { board.removeUnit(donor); board.addUnit(donor, tb.num); }
    });
    // Why lines for colleagues who ended up together.
    units.forEach(function (u) {
      if (u.table === null || u.why !== 'Spread across tables') return;
      var here = Object.keys(u.wants).map(function (id) { return ctx.unitById[id]; }).filter(function (v) { return v.table === u.table; });
      var asked = here.filter(function (v) { return u.asked[v.id]; }), same = here.filter(function (v) { return !u.asked[v.id] && u.sameName[v.id]; });
      if (asked.length) u.why = 'Asked to sit with ' + asked.map(function (v) { return v.name; }).join(', ');
      else if (same.length) u.why = 'Same last name as ' + same.map(function (v) { return v.name; }).join(', ');
    });
  }

  // ---------- Step 4: seats left for students ----------

  // How many more students each table takes, so every table's total is as even as possible: one
  // student at a time to the least full table, ties to the most seats left, then the rotation.
  function quotas(ctx, board, count) {
    var q = {}, left = count;
    ctx.tables.forEach(function (tb) { q[tb.num] = 0; });
    while (left > 0) {
      var bestTb = null, bestTotal = 0, bestRoom = 0;
      for (var i = 0; i < ctx.tables.length; i++) {
        var tb = ctx.tables[i], t = board.t[tb.num], total = t.used + q[tb.num], room = t.seats - total;
        if (room <= 0) continue;
        if (!bestTb || total < bestTotal || (total === bestTotal && (room > bestRoom || (room === bestRoom && tb.rot < bestTb.rot)))) { bestTb = tb; bestTotal = total; bestRoom = room; }
      }
      if (!bestTb) break;
      q[bestTb.num]++; left--;
    }
    return q;
  }

  // ---------- Step 5: the Mixed sort ----------

  // Deals each form in form order, students within a form in shuffle order, each to the table with
  // the fewest students of that form, ties to the table with the most seats left, then the rotation.
  function dealMixed(ctx, board, students) {
    var pending = students.filter(function (s) { return board.at[s.id] === undefined; });
    var q = quotas(ctx, board, pending.length);
    pending.sort(function (a, b) { return a.formIndex - b.formIndex || byKey(a, b); }).forEach(function (s) {
      var bestTb = null, bestN = 0;
      ctx.tables.forEach(function (tb) {
        if (q[tb.num] <= 0) return;
        var n = board.t[tb.num].form[s.form] || 0;
        if (!bestTb || n < bestN || (n === bestN && (q[tb.num] > q[bestTb.num] || (q[tb.num] === q[bestTb.num] && tb.rot < bestTb.rot)))) { bestTb = tb; bestN = n; }
      });
      if (!bestTb) { couldNotSeat(ctx, s, 'No table had a free seat. Add a table or seats in the Tables tab.'); return; }
      board.person(s, bestTb.num, 1); q[bestTb.num]--; s.why = 'Dealt by form';
    });
  }

  // ---------- Step 6: the Together sort ----------

  // Tables in room order, grouped by row. Neighbors are consecutive numbers in the same row.
  function runs(ctx, k) {
    var out = [], list = ctx.tables;
    for (var i = 0; i + k <= list.length; i++) {
      var ok = true;
      for (var j = 1; j < k && ok; j++) ok = list[i + j].row === list[i].row && list[i + j].num === list[i + j - 1].num + 1;
      if (ok) out.push(list.slice(i, i + k));
    }
    return out;
  }
  function neighborsInOneRow(nums, ctx) {
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    for (var i = 1; i < sorted.length; i++) {
      var a = ctx.tableByNum[sorted[i - 1]], b = ctx.tableByNum[sorted[i]];
      if (!a || !b || a.row !== b.row || b.num !== a.num + 1) return false;
    }
    return true;
  }

  // Groups students by the Together by column. Faculty whose Faculty list group matches sit with
  // that group. A group bigger than a table is split over as few neighboring tables in one row as
  // possible; other groups fill the remaining seats largest first, whole when they fit.
  function seatTogether(ctx, board, students, units) {
    var byLabel = {}, groups = [], label = ctx.model.together.label;
    students.filter(function (s) { return board.at[s.id] === undefined; }).sort(byKey).forEach(function (s) {
      var g = byLabel[SMRead.norm(s.group)];
      if (!g) { g = byLabel[SMRead.norm(s.group)] = { label: s.group, students: [], units: [], key: fnv(ctx.ev.seed + '|group|' + s.group) }; groups.push(g); }
      g.students.push(s);
    });
    units.forEach(function (u) {
      if (u.table !== null) return;
      for (var i = 0; i < u.members.length; i++) {
        var g = u.members[i].group && byLabel[SMRead.norm(u.members[i].group)];
        if (g) { g.units.push(u); return; }
      }
    });
    groups.forEach(function (g) { g.size = g.students.length + sum(g.units, function (u) { return u.seats; }); });
    var total = sum(ctx.tables, function (tb) { return board.t[tb.num].used; }) + sum(groups, function (g) { return g.students.length; }) +
      sum(units.filter(function (u) { return u.table === null; }), function (u) { return u.seats; });
    var level = Math.max(1, Math.ceil(total / ctx.tables.length));
    var freeAdults = sum(units.filter(function (u) { return u.table === null && !groups.some(function (g) { return g.units.indexOf(u) >= 0; }); }), function (u) { return u.members.length; });
    var current = null;
    // A table with no faculty keeps one seat for a faculty member while some are still to be
    // seated, unless the group being placed brings its own.
    function reserve(tb) { return board.t[tb.num].adults === 0 && freeAdults > 0 && !(current && current.units.length) ? 1 : 0; }
    // Room up to the even fill level, so every table keeps space for its share of people.
    function roomL(tb) { var t = board.t[tb.num]; return Math.min(t.seats, level) - t.used - reserve(tb); }
    function roomS(tb) { return board.room(tb.num) - reserve(tb); }

    function placeIn(g, tables, why) {
      g.units.slice().sort(function (a, b) { return b.seats - a.seats || byKey(a, b); }).forEach(function (u) {
        var tb = tables.filter(function (x) { return board.room(x.num) >= u.seats; }).sort(function (a, b) { return board.t[a.num].adults - board.t[b.num].adults || roomL(b) - roomL(a) || a.num - b.num; })[0];
        if (tb) { board.addUnit(u, tb.num); u.why = why; }
      });
      g.students.forEach(function (s) {
        var tb = tables.filter(function (x) { return roomS(x) > 0; }).sort(function (a, b) { return roomL(b) - roomL(a) || a.num - b.num; })[0];
        if (!tb) tb = ctx.tables.filter(function (x) { return roomS(x) > 0; }).sort(function (a, b) { return roomL(b) - roomL(a) || a.num - b.num; })[0];
        if (!tb) tb = ctx.tables.filter(function (x) { return board.room(x.num) > 0; }).sort(function (a, b) { return a.num - b.num; })[0];
        if (!tb) { couldNotSeat(ctx, s, 'No table had a free seat. Add a table or seats in the Tables tab.'); return; }
        board.person(s, tb.num, 1); s.why = why;
      });
    }
    groups.sort(function (a, b) { return b.size - a.size || a.key - b.key; }).forEach(function (g) {
      var why = label + ': ' + g.label;
      current = g;
      // Whole at one table: first fit by room order, at the even fill level if possible, else up to Seats.
      var whole = ctx.tables.filter(function (tb) { return roomL(tb) >= g.size; })[0] || ctx.tables.filter(function (tb) { return roomS(tb) >= g.size; })[0];
      if (whole) { placeIn(g, [whole], why); return; }
      // Split over as few neighboring tables in one row as possible, walking the rows from A.
      var maxSeats = Math.max.apply(null, ctx.tables.map(function (tb) { return tb.seats; }));
      for (var k = Math.max(2, Math.ceil(g.size / maxSeats)); k <= ctx.tables.length; k++) {
        var all = runs(ctx, k);
        var run = all.filter(function (r) { return sum(r, roomL) >= g.size && r.every(function (tb) { return roomL(tb) > 0; }); })[0] ||
          all.filter(function (r) { return sum(r, roomS) >= g.size && r.every(function (tb) { return roomS(tb) > 0; }); })[0];
        if (run) { placeIn(g, run, why); return; }
      }
      var spread = ctx.tables.filter(function (tb) { return roomL(tb) > 0; });
      placeIn(g, spread.length ? spread : ctx.tables, why);
      current = null;
      ctx.notes.push(label + ' "' + g.label + '" could not fit at neighboring tables in one row, so it is split across rows.');
    });
    seatAdults(ctx, board, units.filter(function (u) { return u.table === null; }));
  }

  // ---------- Step 7: better seats ----------

  // Tries swapping two students at different tables, and moving a student to a table with a free
  // seat, keeping a change only if the rule results get better by rank. Goes through students in
  // shuffle order and stops when a round changes nothing (at most 100 rounds). Locked students
  // never move. In the Together sort, students only swap within their own group.
  function improve(ctx, board, students) {
    var active = ctx.active;
    if (!active.length) return;
    var movable = students.filter(function (s) { return !s.locked && board.at[s.id] !== undefined; }).sort(byKey);
    var together = ctx.ev.sort === 'Together';
    function score(num) { return scoreTable(board.t[num], active); }
    function sameFacts(a, b) { return a.form === b.form && a.genderKey === b.genderKey && a.bd === b.bd && a.waited === b.waited && a.lastTable === b.lastTable; }
    function swap(s, t) {
      var a = board.at[s.id], b = board.at[t.id];
      board.person(s, a, -1); board.person(t, b, -1); board.person(s, b, 1); board.person(t, a, 1);
    }
    function move(s, to) { var a = board.at[s.id]; board.person(s, a, -1); board.person(s, to, 1); }
    for (var round = 0; round < 100; round++) {
      var changed = false;
      for (var i = 0; i < movable.length; i++) {
        var s = movable[i], a = board.at[s.id], sa = score(a);
        if (allZero(sa)) continue;
        var done = false;
        for (var j = 0; j < movable.length && !done; j++) {
          var t = movable[j], b = board.at[t.id];
          if (b === a || sameFacts(s, t) || (together && s.group !== t.group)) continue;
          var before = add(sa, score(b));
          swap(s, t);
          var at = improvedAt(before, add(score(a), score(b)));
          if (at >= 0) { done = true; s.why = t.why = 'Swapped to meet rule ' + active[at].rank; }
          else swap(s, t);
        }
        if (!done && !together) {
          for (var k = 0; k < ctx.tables.length && !done; k++) {
            var to = ctx.tables[k].num;
            if (to === a || board.room(to) < 1 || board.t[a].used - board.t[to].used < 1) continue;
            var before2 = add(sa, score(to));
            move(s, to);
            var at2 = improvedAt(before2, add(score(a), score(to)));
            if (at2 >= 0) { done = true; s.why = 'Swapped to meet rule ' + active[at2].rank; }
            else move(s, a);
          }
        }
        if (done) changed = true;
      }
      if (!changed) break;
    }
  }

  // ---------- Step 8: waiters ----------

  function formAllowed(s, list) {
    return !list || list.indexOf(SMRead.norm(s.form)) >= 0 || list.indexOf(SMRead.norm(s.formRaw)) >= 0;
  }
  // At each table, picks the waiters, then the assistants: the student who has waited the fewest
  // times this school year, then one who didn't wait at the last event, then shuffle order.
  function pickWaiters(ctx, board, students) {
    var count = ctx.waiting.countById, last = ctx.waiting.lastIds, byTable = {};
    students.forEach(function (s) {
      s.role = '';
      var num = board.at[s.id];
      if (num !== undefined) (byTable[num] = byTable[num] || []).push(s);
    });
    function fairer(a, b) { return (count[a.id] || 0) - (count[b.id] || 0) || (last[a.id] ? 1 : 0) - (last[b.id] ? 1 : 0) || byKey(a, b); }
    ctx.tables.forEach(function (tb) {
      var list = byTable[tb.num] || [];
      list.filter(function (s) { return formAllowed(s, ctx.ev.waiterForms); }).sort(fairer).slice(0, ctx.ev.waitersPerTable).forEach(function (s) { s.role = 'Waiter'; });
      list.filter(function (s) { return !s.role && formAllowed(s, ctx.ev.assistantForms); }).sort(fairer).slice(0, ctx.ev.assistantsPerTable).forEach(function (s) { s.role = 'Assistant'; });
    });
  }

  // ---------- The working list ----------

  function whyFor(u, m) {
    if (u.locked) return u.why;
    if (u.members.length > 1) return 'Household with ' + names(u.members.filter(function (x) { return x !== m; }));
    return u.why || 'Spread across tables';
  }
  // One row per person (and per guest seat), as SM Seating shows it.
  function seatingRows(ctx, board) {
    var rows = [];
    ctx.units.forEach(function (u) {
      if (u.table === null) return;
      u.members.forEach(function (m) { rows.push({ table: u.table, tableText: String(u.table), name: m.name, kind: 'Faculty', form: '', role: '', email: m.email, locked: u.locked, why: whyFor(u, m), person: m }); });
      u.guests.forEach(function (g) { rows.push({ table: u.table, tableText: String(u.table), name: g.named ? g.name : 'Guest of ' + g.host.name, kind: 'Guest', form: '', role: '', email: g.host.email, locked: u.locked, why: 'Guest of ' + g.host.name, host: g.host }); });
    });
    ctx.students.forEach(function (s) {
      var num = board.at[s.id];
      if (num === undefined) return;
      rows.push({ table: num, tableText: String(num), name: s.name, kind: 'Student', form: s.form, role: s.role, email: s.email, locked: s.locked, why: s.why, person: s });
    });
    return rows;
  }

  // ---------- Sort ----------

  function sort(model) {
    var ctx = prepare(model), board = new Board(ctx);
    placeLocks(ctx, board);
    if (ctx.ev.sort === 'Together') seatTogether(ctx, board, ctx.students, ctx.units);
    else { seatAdults(ctx, board, ctx.units); dealMixed(ctx, board, ctx.students); }
    improve(ctx, board, ctx.students);
    pickWaiters(ctx, board, ctx.students);
    var rows = seatingRows(ctx, board);
    return finish(ctx, rows, true);
  }

  // ---------- Check (used by Sort and by Check again) ----------

  // Finds the person behind each SM Seating row: students and faculty by email (a student with no
  // email by name), guests by their host's email.
  function identify(ctx, rows) {
    var noEmail = ctx.students.filter(function (s) { return !s.email; });
    rows.forEach(function (r) {
      if (r.person || r.host) return;
      var kind = SMRead.norm(r.kind), email = SMRead.norm(r.email);
      if (kind === 'guest') r.host = ctx.adultById[email] || null;
      else if (kind === 'faculty') r.person = ctx.adultById[email] || null;
      else if (email) r.person = ctx.studentById[email] || null;
      else r.person = noEmail.filter(function (s) { return SMRead.nameKey(s.name) === SMRead.nameKey(r.name); })[0] || null;
    });
  }
  function where(r) { return r.row ? 'Row ' + r.row + ': ' : ''; }

  // Checks a seating against every hard limit and rule. Returns SM Check rows, counts and the
  // SM Needs you rows it adds.
  function check(ctx, rows, includeNotes) {
    identify(ctx, rows);
    var out = [], needs = [], board = new Board(ctx), seatsOf = {}, bad = { seat: [], inUse: [], over: [], adult: [], household: [], locks: [], roles: [] };
    rows.forEach(function (r) {
      var tb = ctx.tableByNum[r.table];
      if (!tb) bad.inUse.push(where(r) + r.name + ' is at table "' + r.tableText + '", which is not in use.');
      var kind = SMRead.norm(r.kind);
      if (kind === 'guest') {
        if (!r.host) bad.household.push(where(r) + 'guest "' + r.name + '" has no faculty host who is coming with the email "' + r.email + '".');
        if (tb) board.t[tb.num].used++;
        return;
      }
      var p = r.person;
      if (!p) {
        var known = SMRead.norm(r.email) && (ctx.allStudentById[SMRead.norm(r.email)] || ctx.allAdultById[SMRead.norm(r.email)]);
        bad.seat.push(where(r) + r.name + (known ? ' is not attending.' : ' is not anyone in Students or the faculty who are coming.'));
        if (tb) board.t[tb.num].used++;
        return;
      }
      (seatsOf[p.id] = seatsOf[p.id] || []).push(r);
      if (seatsOf[p.id].length > 1) { if (tb) board.t[tb.num].used++; return; }
      if (tb) board.person(p, tb.num, 1);
      var role = SMRead.norm(r.role);
      if (role && !(p.kind === 'Student' && (role === 'waiter' || role === 'assistant'))) bad.roles.push(where(r) + r.name + ': role "' + r.role + '" (roles are Waiter or Assistant, for students only).');
    });
    Object.keys(seatsOf).forEach(function (id) {
      var list = seatsOf[id];
      if (list.length > 1) bad.seat.push(list[0].name + ' is seated ' + list.length + ' times (' + list.map(function (r) { return r.row ? 'row ' + r.row : 'table ' + r.tableText; }).join(', ') + ').');
    });
    ctx.students.concat(ctx.adults).forEach(function (p) { if (!seatsOf[p.id]) bad.seat.push(p.name + ' is coming but has no seat.'); });

    var adultsComing = ctx.adults.length;
    ctx.tables.forEach(function (tb) {
      var t = board.t[tb.num];
      if (t.used > t.seats) bad.over.push('Table ' + tb.num + ': ' + t.used + ' people for ' + t.seats + ' seats.');
      if (t.used > 0 && t.adults === 0) bad.adult.push('Table ' + tb.num);
    });
    // Households and guests sit with their faculty member.
    ctx.units.forEach(function (u) {
      var tables = {};
      u.members.forEach(function (m) { if (seatsOf[m.id]) tables[seatsOf[m.id][0].table] = true; });
      if (Object.keys(tables).length > 1) bad.household.push('Household ' + u.name + ' is split across tables ' + Object.keys(tables).join(', ') + '.');
      u.members.forEach(function (m) {
        var mine = rows.filter(function (r) { return r.host === m; }), home = seatsOf[m.id] ? seatsOf[m.id][0].table : null;
        var expected = m.guestSeats;
        if (mine.length !== expected) bad.household.push(m.name + ' has ' + plural(expected, 'guest seat') + ' but ' + plural(mine.length, 'guest row') + ' in the list.');
        mine.forEach(function (r) { if (home !== null && r.table !== home) bad.household.push(where(r) + r.name + ' is at table ' + r.tableText + ', not with ' + m.name + ' at table ' + home + '.'); });
      });
    });
    Object.keys(ctx.lockTargets || {}).forEach(function (id) {
      var p = ctx.studentById[id] || ctx.adultById[id], at = seatsOf[id] ? seatsOf[id][0].table : null;
      if (at !== ctx.lockTargets[id]) bad.locks.push(p.name + ' is locked to table ' + ctx.lockTargets[id] + ' but sits at ' + (at === null ? 'no table' : 'table ' + at) + '.');
    });

    function row(rule, result, details) { out.push({ rule: rule, result: result, details: details }); }
    function hard(rule, list, okText) { row(rule, list.length ? 'Fail' : 'Pass', list.length ? list.join(' ') : okText); }
    hard('Everyone coming has exactly one seat', bad.seat, plural(ctx.students.length, 'student') + ' and ' + ctx.adults.length + ' faculty, each seated once.');
    hard('Everyone sits at a table in use', bad.inUse, 'All rows are at tables marked In use.');
    hard('No table holds more people than its Seats', bad.over, 'Every table is within its Seats.');
    if (adultsComing >= ctx.tables.length) hard('Every table has at least one adult', bad.adult.map(function (t) { return t + ' has no faculty.'; }), 'Every table has faculty.');
    else row('Every table has at least one adult', bad.adult.length ? 'Warning' : 'Pass', bad.adult.length ? 'Only ' + adultsComing + ' faculty for ' + ctx.tables.length + ' tables. No faculty at: ' + bad.adult.join(', ') + '.' : 'Every table has faculty.');
    hard('Households and guests sit with their faculty member', bad.household, 'Every household and guest is at their faculty member\'s table.');
    hard('Locked seats are honored', bad.locks, Object.keys(ctx.lockTargets || {}).length ? 'Every locked seat is honored.' : 'No locked seats.');
    hard('Roles are Waiter or Assistant, for students only', bad.roles, 'Every role is a student\'s Waiter or Assistant.');
    bad.adult.forEach(function (t) { needs.push({ section: 'Tables without an adult', name: t, email: '', problem: 'No faculty at this table. Move a faculty member here in SM Seating, or add one to Locked seats and Sort again.' }); });

    var totals = ctx.tables.map(function (tb) { return board.t[tb.num].used; }), most = Math.max.apply(null, totals), least = Math.min.apply(null, totals);
    row('Tables evenly filled (within one person)', most - least > 1 ? 'Warning' : 'Pass', most - least > 1 ? 'Most: ' + most + ' people; least: ' + least + '. ' + (ctx.ev.sort === 'Together' ? 'The Together sort keeps groups whole first.' : 'Locks, seats or hand edits make it uneven.') : 'Every table has ' + least + (most > least ? ' or ' + most : '') + ' people.');

    // The rules, in rank order.
    var rulesNotMet = 0, byTable = {};
    rows.forEach(function (r) { if (r.person && ctx.tableByNum[r.table]) (byTable[r.table] = byTable[r.table] || []).push(r.person); });
    ctx.rules.forEach(function (rule) {
      var title = 'Rule ' + rule.rank + ': ' + rule.text + (rule.id === 'forms' || rule.id === 'perForm' ? ' (' + rule.value + ')' : '');
      if (rule.status !== 'active') { row(title, 'Not checked', rule.reason); return; }
      var issues = ruleIssues(ctx, board, rule, byTable, rows);
      if (issues.length) rulesNotMet++;
      row(title, issues.length ? 'Warning' : 'Pass', issues.length ? issues.join('; ') + '.' : rule.id === 'neighbors' ? 'Every split group sits at neighboring tables in one row.' : 'Met at every table.');
    });

    // Waiters: per form at this event and this year, and tables without one.
    var forms = ctx.model.forms, thisEvent = {}, year = {}, students = {}, waitedYear = {};
    rows.forEach(function (r) {
      if (!r.person || r.person.kind !== 'Student' || seatsOf[r.person.id][0] !== r) return;
      var f = r.person.form, role = SMRead.roleOf(r.role);
      students[f] = (students[f] || 0) + 1;
      thisEvent[f] = thisEvent[f] || { w: 0, a: 0 };
      if (role === 'Waiter') thisEvent[f].w++;
      if (role === 'Assistant') thisEvent[f].a++;
      var times = (ctx.waiting.countById[r.person.id] || 0) + (role ? 1 : 0);
      year[f] = (year[f] || 0) + times;
      if (times) waitedYear[f] = (waitedYear[f] || 0) + 1;
    });
    var most2 = 0;
    rows.forEach(function (r) { if (r.person && r.person.kind === 'Student') most2 = Math.max(most2, (ctx.waiting.countById[r.person.id] || 0) + (SMRead.roleOf(r.role) ? 1 : 0)); });
    row('Waiters at this event, by form', 'Pass', forms.filter(function (f) { return students[f]; }).map(function (f) { return f + ': ' + plural(thisEvent[f].w, 'waiter') + ', ' + plural(thisEvent[f].a, 'assistant'); }).join('; ') + '.');
    row('Waiting this school year, by form (this event included)', 'Pass', forms.filter(function (f) { return students[f]; }).map(function (f) { return f + ': ' + plural(year[f] || 0, 'time') + ', ' + (waitedYear[f] || 0) + ' of ' + students[f] + ' students'; }).join('; ') +
      '. Most times one student has waited since ' + ctx.waiting.since + ': ' + most2 + '.');
    var noWaiter = [];
    ctx.tables.forEach(function (tb) {
      var here = rows.filter(function (r) { return r.table === tb.num && r.person && r.person.kind === 'Student'; });
      if (!here.length) return;
      var w = here.filter(function (r) { return SMRead.roleOf(r.role) === 'Waiter'; }).length, a = here.filter(function (r) { return SMRead.roleOf(r.role) === 'Assistant'; }).length;
      if (w < ctx.ev.waitersPerTable || a < ctx.ev.assistantsPerTable) noWaiter.push('Table ' + tb.num + ': ' + plural(w, 'waiter') + ', ' + plural(a, 'assistant') + (includeNotes ? ' (not enough students from the Waiter or Assistant forms)' : ''));
    });
    row('Every table has its waiter and assistant', noWaiter.length ? 'Warning' : 'Pass', noWaiter.length ? noWaiter.join('; ') + '.' : 'Every table has ' + plural(ctx.ev.waitersPerTable, 'waiter') + ' and ' + plural(ctx.ev.assistantsPerTable, 'assistant') + '.');
    if (includeNotes) ctx.notes.forEach(function (n) { row('Sort couldn\'t do this', 'Warning', n); });

    var failures = out.filter(function (r) { return r.result === 'Fail'; }).length, warnings = out.filter(function (r) { return r.result === 'Warning'; }).length;
    return { rows: out, needs: needs, failures: failures, warnings: warnings, rulesNotMet: rulesNotMet };
  }

  // The exact tables and people where one rule is not met.
  function ruleIssues(ctx, board, rule, byTable, rows) {
    var out = [], v = rule.value;
    if (rule.id === 'neighbors') {
      var tablesOf = {};
      rows.forEach(function (r) { if (r.person && r.person.kind === 'Student' && ctx.tableByNum[r.table]) { var g = r.person.group; (tablesOf[g] = tablesOf[g] || {})[r.table] = true; } });
      Object.keys(tablesOf).sort().forEach(function (g) {
        var nums = Object.keys(tablesOf[g]).map(Number);
        if (nums.length > 1 && !neighborsInOneRow(nums, ctx)) out.push(g + ' at tables ' + nums.sort(function (a, b) { return a - b; }).join(', '));
      });
      return out;
    }
    ctx.tables.forEach(function (tb) {
      var t = board.t[tb.num], people = byTable[tb.num] || [];
      if (rule.id === 'forms') { var d = distinctForms(t); if (t.students > 0 && d < v) out.push('Table ' + tb.num + ': ' + plural(d, 'form')); }
      else if (rule.id === 'perForm') Object.keys(t.form).forEach(function (f) { if (t.form[f] > v) out.push('Table ' + tb.num + ': ' + t.form[f] + ' ' + f + ' students'); });
      else if (rule.id === 'tablemates') {
        var byLast = {};
        people.forEach(function (p) { if (p.lastTable !== null && p.lastTable !== undefined) (byLast[p.lastTable] = byLast[p.lastTable] || []).push(p); });
        Object.keys(byLast).forEach(function (L) { if (byLast[L].length > 1) out.push('Table ' + tb.num + ': ' + names(byLast[L]) + ' (together at table ' + L + ' at ' + ctx.last.event + ')'); });
      }
      else if (rule.id === 'waited') { if (t.students > 0 && t.waited === 0) out.push('Table ' + tb.num + ': nobody has waited before'); }
      else if (rule.id === 'gender') { if (t.female === 1) out.push('Table ' + tb.num + ': one Female student'); if (t.male === 1) out.push('Table ' + tb.num + ': one Male student'); }
      else if (rule.id === 'boarding') { if (t.B + t.D >= 2 && (t.B === 0 || t.D === 0)) out.push('Table ' + tb.num + ': only ' + (t.B ? 'boarding' : 'day') + ' students'); }
      else if (rule.id === 'sameStudents' || rule.id === 'sameFaculty') {
        var kind = rule.id === 'sameStudents' ? 'Student' : 'Faculty';
        people.forEach(function (p) { if (p.kind === kind && p.lastTable === tb.num) out.push(p.name + ' (table ' + tb.num + ' again)'); });
      }
    });
    return out;
  }

  function finish(ctx, rows, fromSort) {
    var chk = check(ctx, rows, fromSort);
    return { ctx: ctx, rows: rows, check: chk, needs: ctx.needs.concat(chk.needs), fromSort: fromSort };
  }

  // Check again: reads the hand-edited SM Seating as the truth and checks it. Never moves anyone.
  function checkAgain(model, seating) {
    var ctx = prepare(model);
    ctx.lockTargets = {};
    ctx.locks.forEach(function (L) { ctx.lockTargets[L.person.id] = L.table; });
    var rows = seating.map(function (r) {
      return { row: r.row, table: r.table, tableText: r.tableText, name: r.name, kind: r.kind, form: r.form, role: SMRead.roleOf(r.role) || r.role, email: r.email, locked: r.locked, why: r.why };
    });
    return finish(ctx, rows, false);
  }

  return { fnv: fnv, prepare: prepare, Board: Board, scoreTable: scoreTable, improvedAt: improvedAt, sort: sort, check: check, checkAgain: checkAgain, neighborsInOneRow: neighborsInOneRow };
}());
