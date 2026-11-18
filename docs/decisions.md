# Decisions

The spec is `docs/spec.md` and is never rewritten. This file holds the calls made while building it. Where the two differ, this file wins.

## Milestones

- [x] 1. Context: Cursor rule, AGENTS.md, this file, package.json, CI, .gitattributes, fake spreadsheet, smoke test
- [x] 2. core/read.js, setup tabs with defaults, Main.gs reading and write helpers, core/practice.js and Make practice data
- [x] 3. core/seat.js steps 1 to 5 and 7, all rules
- [x] 4. Waiters (step 8) and history reading
- [x] 5. core/output.js, every SM tab, Sort end to end, Sort again with a new shuffle
- [x] 6. Check again
- [x] 7. Save this event to history, Add a past event to history (the Candlelight version ends here)
- [x] 8. The Together sort with neighboring tables
- [x] 9. Bundle script, demo script, e2e, safety and bundle tests, demo read as Mr. Gibbs would
- [x] 10. README, Done checklist, pull request

## Calls I made

Calls Cayden or Mr. Gibbs should look at first are marked **(check)**.

### Students and seasons
- **(check)** Make practice data sets Event "Season" to "Fall 2026 - 2027". The practice file has Winter rows for 40 students (as the spec asks), and with Season blank the latest season would be Winter, which would seat only those 40. Real use is unchanged: blank Season means the latest season.
- **(check)** Students who have rows only in other seasons (not the one used) are not seated, and each is listed in SM Needs you, so a half-finished winter roster can't silently drop people.
- A Season typed in Event matches ignoring case and spaces ("Fall 2026-2027" equals "Fall 2026 - 2027"). A Season that matches no row stops Sort and lists the seasons that exist.
- Forms are listed by class year (seniors first), then the names Senior to Freshman, then anything else sorted. A blank form is "No form", listed last.
- Not attending also applies to faculty (matched the same way: email, or name when the email is blank). A Not attending row that matches nobody coming is listed in SM Needs you.

### Faculty
- **(check)** "Adults per table" counts faculty only, not their guests. Sort aims for at most max(Adults per table, faculty ÷ tables, rounded up) at a table.
- **(check)** Guest seats are the answer to question 5 minus any faculty spouse named in question 4 (a household doesn't take a guest seat), and never fewer than the non-faculty names given. Unnamed extra seats show as "Guest of <name>".
- **(check)** A mentor seated with a new colleague may take a table above the adult target; the pairing wins.
- Placement order for each faculty unit, after households, new faculty and mentors: a table with a requested colleague first, then (rule 9 on) not their table from last event, then the fewest faculty, then the most room, then the rotating start. A guard keeps enough faculty back to give every table one, and a last step moves a single faculty member to any table that still has none.
- "Will you attend": anything not starting with N counts as coming (the spec's blank and Y cases included). New is an answer starting "I'm new"; Mentor is an answer containing "glad".
- A missing Faculty tab is a warning, not a stop: only Faculty list people are known, and they are seated only if "Faculty who didn't answer" is Seat.

### Rules and checking
- **(check)** In SM Check a broken hard limit is "Fail" and a rule that isn't fully met is "Warning". "C rules not fully met" in the finish message counts the rules with a Warning.
- **(check)** Rule 6 counts Female and Male only. Other values and blanks are not counted, so no student is moved because of a less common gender value.
- How each rule is counted when Sort compares two seatings: rule 1, forms missing at a table; rule 2, students over the limit; rule 3, pairs of people who also shared a table last time (faculty included, since the rule says "nobody"); rule 4, tables with no one who has waited; rule 6, tables with exactly one Female or one Male student; rule 7, tables with only boarders or only day students; rules 8 and 9, people back at their old table number.
- SM Check also has a hard-limit row "Roles are Waiter or Assistant, for students only" (for hand edits) and a row "Tables evenly filled (within one person)", which is a Warning, not a Fail, because locks and the Together sort can make it uneven on purpose.
- Information rows in SM Check (waiters per form at this event and this year) show "Pass" in the Result column, since the spec allows only Pass, Warning, Fail or Not checked there.
- Rules on the Rules tab are recognized by phrases in their text, so small rewording still works. A rule missing from the tab is off; a row the tool doesn't know is skipped with a warning. "Rule N" in SM Check and in "Swapped to meet rule N" is the rule's position after sorting by Rank.
- Step 7 moves a student only to a table that is not fuller than theirs, so table totals stay within one person.

### Waiters
- **(check)** The waiter order follows the spec exactly: fewest times waited this school year (August 1 on, both roles), then not at the last event, then the shuffle. So a student who waited once, at the last event, still goes before a student who waited twice earlier.
- "The last event" for waiters is the latest date in Waiter history before this event; for the seating rules it is the latest date in Seating history before this event.
- Step 8 runs once, after all the swap rounds of step 7. Rule 4 depends on Waiter history, not on this event's roles, so this gives the same result as re-running step 8 after each round.
- Roles go to students only.

### The Together sort
- **(check)** Group sizes are compared to an even fill level (everyone coming ÷ tables, rounded up). A group goes whole at the first table with room under that level, else at the first with room under Seats. A group too big for any table is split over as few neighboring tables in one row as possible (counted from the largest Seats), walking rows A to E.
- **(check)** In the Together sort, step 7 only swaps students within the same group, and never moves a student, so groups stay whole. Repeat-tablemate and same-table rules can stay as warnings in Together. "Tables evenly filled" is often a Warning there; SM Check says why.
- A table with no faculty yet keeps one seat free while faculty without a group are still to be seated, so every table can get an adult.
- Faculty join a group when their Faculty list group equals the group's value (ignoring case). Their household and guests come with them.

### History and the importer
- **(check)** Add a past event to history asks before replacing an event already in history (the same question as Save this event to history). That is how a person re-runs it after typing the right emails into Past event.
- The importer matches each row to students first, then to faculty, so faculty rows land in Seating history too (rule 9 needs them). Guest rows are skipped. Faculty never get a waiter role. A person matched twice keeps the first row; the second goes to SM Needs you.
- Add a past event writes SM Needs you with only its own problems (the next Sort rebuilds the full list).
- Dates are written to the history tabs as YYYY-MM-DD text; Sheets turns them into dates, and both are read.
- Save this event to history saves students and faculty (guests are not tracked) and every Waiter and Assistant.

### Sheets side
- Two write helpers beyond the spec's three: `rewriteHistory_` (only Seating history and Waiter history, only after the person says Yes to replacing an event) and `setEventValue_` (only Seed, for Sort again, and Season, for practice data). Make practice data uses its own `writePracticeTabs_`, which refuses if Students or Faculty has data. The safety test fails on any write outside these six.
- SM Seating has its note on row 1 and headers on row 2 (both frozen). Check again finds the header row by its Table and Name headers.
- Guest rows in SM Seating carry their host's email in the Email column, so Check again knows whose guest each row is. SM Needs you has the columns Section, Name, Email, Problem.
- Sort again asks its two questions before adding 1 to the Seed, so Cancel leaves the Seed alone.

### Code and tests
- Core files never use `require` or `module`. The tests load them into one sandbox, the way Apps Script loads its files into one global scope, so the tests run exactly what goes into the paste file.
- `npm run bundle` also writes the generated `apps-script/*.gs` copies, which are committed; CI rebuilds and fails if they differ.
- The demo also runs Add a past event to history (Practice dinner B), so the repeat rules have a last event to work on.
- Name matching keeps each person's name forms on the person, and the closest-name suggestions run only for rows that matched nobody. Matching a 440-row past event takes about 50 ms in Node; Sort on the practice data about 25 ms.
- The rule-ranking test checks the comparator directly (a change that helps rule 3 but breaks rule 1 is refused) and runs a small seating where rule 1 and rule 8 conflict; rule 3 can't conflict with rule 1 in a fixture that small.
- Faculty names: the last word is the last name (for sorting SM Faculty).

### Repository
- The first push failed: the GitHub login on this computer can't change `.github/workflows/` (its token lacks the `workflow` scope). Everything is committed locally on feature/seating-tool; the push needs `gh auth refresh -h github.com -s workflow` once, then `git push`.

## Done checklist

- [x] npm test passes locally, and every test file in the spec exists.
- [x] npm run demo runs the whole flow on practice data with no errors; every SM Check failure is planted, every warning planted or explained.
- [x] Sorting the practice data twice with the same Seed gives identical SM tabs (apart from the run log time).
- [x] paste-into-apps-script/SeatedMeals.gs is up to date and starts with /** @OnlyCurrentDoc */.
- [x] The four shared tabs show only names, form, table, role and guests.
- [x] No real names, emails, links or spreadsheet IDs anywhere in the branch. Practice emails end in @example.org.
- [x] No TODO, FIXME or placeholder logic in core/ or apps-script/.
- [x] docs/spec.md is unchanged. This file lists every call. The README, AGENTS.md and the Cursor rule agree with both.
- [ ] The PR is open into main, titled "Seated meals tool: first version for Candlelight", template filled in, not merged.
- [x] No Co-authored-by, Generated with, Made-with or any other AI attribution line in any commit message or the PR.
