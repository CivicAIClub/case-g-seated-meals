This text is the build spec for Case G, the seated meals tool. If docs/spec.md doesn't exist yet, first save this whole text as docs/spec.md, word for word. From then on docs/spec.md is the spec: re-read it whenever your context gets summarized or you start in a new chat, and never rewrite it. Your own calls go in docs/decisions.md; where the two differ, docs/decisions.md wins.

Read .cursor/rules/, AGENTS.md and README.md first. They were written before the client meeting and are out of date (they say the first meeting is being scheduled and list the wrong team). Where anything in the repo disagrees with this spec, this spec wins, and milestone 1 replaces them.

Pull main and create the branch feature/seating-tool. If that branch already exists (Cayden may have pushed it with only this spec on it, or an earlier run started it), check it out, pull it, and continue from docs/decisions.md if it exists instead of starting over.

This spec is the whole job, in one pull request. Work through the milestones near the end in order. After each one, run npm test, commit, and push the branch. If a push fails, keep committing locally, carry on, and say so when you stop. Milestones 1 to 7 are what Mr. Gibbs needs for Candlelight; if you run short, finish those first.

Don't ask me questions, and don't stop to offer options. When something is unclear, make the most reasonable call, write it in docs/decisions.md, and keep going. Stop only when every item in the Done checklist is true.

# Situation

Mr. Gibbs, Associate Head of School at Pomfret School, runs the school's seated meals: formal dinners where every student and the attending faculty sit at assigned round tables in the dining hall, and some students serve their table as waiters. Today he builds every seating list by hand in a spreadsheet with data sorts, shifting the table numbering each time so the lists come out different. It's slow, he can't track who has waited or who sat together last time, and he'd hold more seated meals if it were easier. Students have asked for more of them.

The next one is Candlelight, Tuesday December 15, 2026. Last year the lists were emailed to all students and faculty the evening before, as a Google Sheet. He needs a first version in hand about a week earlier to review it.

The Civic AI Club is building a tool in Google Sheets that, for each event: seats the attending faculty (with spouses and children who come along), seats every attending student by rules he picks and ranks, picks each table's waiter fairly across the year, checks every rule, and writes the tabs he already sends out. He reviews and edits the result by hand; the tool never has the last word.

This is a plain program: no AI, no model calls, no network. Same input and same seed, same output, every time.

The person running it is a high school student on the club team or Mr. Gibbs himself, following the README. Every message the program shows says in plain English what happened and what to do next.

# Safety rules (they don't bend)

- The repo is public. Build and test with made-up people only. Never put a real student's or faculty member's name, email, table or any other detail in code, tests, fixtures, docs, commit messages or PR text. Club members' names as the team, in the README and the Cursor rule, are fine. Practice emails end in @example.org.
- You never see the real data and never ask for it. The real run happens in Google Sheets, in the school's Google account, by a person.
- No AI, no model calls, no network, no new dependencies. Plain JavaScript in Apps Script; plain Node for tests and scripts.
- The program never writes to the tabs people fill in (Students, Faculty, Past event). Only Make practice data writes those, and only into an otherwise empty spreadsheet.
- The tabs that get shared with the whole school (SM By first name, SM By form, SM By table, SM Faculty) never show gender, boarding or day, dorm, advisory, sport, email or any rule detail: only names, form, table, role and guests.
- No sheet links, spreadsheet IDs or school email addresses anywhere in the repo.
- Don't merge, don't push to main, and don't edit .github/CODEOWNERS.

# What his past seating files show

You can't open these and don't need to. These are the facts the tool is built on, from three of his Google Sheets covering four dinners (2023 to 2026). They're counts only.

- Size: 294 to 349 students and 73 to 91 faculty per dinner, at 42 to 46 tables. Each table had 6 to 8 students and 1 to 2 adults (2 adults is his target; 44 of 46 tables had 2 in September 2026).
- His best method, from September 2026: each form (grade) dealt separately across the tables, so every table had all four forms and at most 3 students from one form. That is the baseline the tool has to match or beat. Earlier dinners dealt students alphabetically, which put six juniors and one sophomore at one table.
- Waiters: at Candlelight 2025 every table had a waiter and an assistant waiter, and they were picked by the alphabet: 38 of 42 waiters had last names A to G. Which forms wait changes by event: at Candlelight 2023 nearly all waiters were seniors; at Candlelight 2025 seniors were mostly spared; at Sundial seniors wait by tradition. No file tracks who has waited, so some students waited at both fall dinners. He wants waiting spread fairly over the year, and never a table where nobody has waited before (a table of new students has nobody to show them how).
- Faculty with the same surname (couples) always sit together. Some faculty bring a spouse or a child, and those seats have to be held at their table.
- Repeat tablemates from one dinner to the next happen by chance (7 to 16 percent of students). He'd like to avoid them for back-to-back events.
- Names are the only key in his files and they drift: preferred names, misspellings, first and last swapped. The tool uses school email as the ID.
- None of his files has gender, advisory, dorm, boarding or day, sport, or a new-student flag. Those will come from a list export (below).
- What he sends out: a Google Sheet with tabs for students by first name, students by form, students by table, and faculty. In 2026 he added one tab per form with three-column print pages.

# What he asked for (Nov 9 meeting)

- Pick how each event is sorted: by form (mixed tables), by advisory, by sport or afternoon commitment, or random with rules, such as "at least 3 forms at every table". Rules chosen and ranked by priority, then one click.
- When a group (an advisory, a team) is too big for one table, its tables should be next to each other in the room.
- Faculty: who's coming, spouses and children (held seats), preferred tablemates, and new faculty seated with someone who can mentor them.
- Waiters random but fair, tracked over the year.
- No repeat tablemates at back-to-back events.
- Output he can review and edit by hand before it goes out.
- Mr. Harrington, who seats Millbrook Day by sport, should be able to use it too.
- Data comes from one-time list exports from the school's student information system (no API), refreshed each trimester for sports.

# The dining hall

47 round tables in five rows across the room: 1 to 10, 11 to 19, 20 to 28, 29 to 38, 39 to 47. Two tables are neighbors only when their numbers are consecutive in the same row: 10 and 11, 19 and 20, 28 and 29, and 38 and 39 are at opposite ends of the room. Not every table is set for every dinner (one dinner skipped 37, 38 and 47; another numbered its tables 1 to 42), so each event has its own list of tables in use.

# The workbook

Tabs people fill in (the program never writes them):
- Students: the list export, one row per student.
- Faculty: one row per adult who might attend, usually the responses of a per-event faculty Google Form.
- Past event (optional): a past seating list pasted in, for Add a past event to history.

Setup tabs (created once with defaults by any menu item, then edited by people, never overwritten):
- Event: Key | Value | Note.
- Rules: Rank | Rule | On | Value | Note.
- Tables: Table | Row | In use | Seats.
- Not attending: Email | Name | Why.
- Locked seats: Email | Name | Table | Why.
- Seating history: Event | Date | Email | Name | Table. Added to by Save this event to history and Add a past event to history; never cleared.
- Waiter history: Event | Date | Email | Name | Role. Same.

Tabs the program writes (every name starts with "SM "):
- SM Seating: the working list, one row per person. People may edit it by hand; Check again reads it.
- SM By first name, SM By form, SM By table, SM Faculty: the four tabs that get shared.
- SM Check, SM Needs you: for the person running it.
- SM Run log: one row added per Sort, never cleared.

Every write goes through helpers in Main.gs, and each helper throws on any other name:
- writeTab_(name, rows): only names starting with "SM ", never "SM Run log". Clears values and formats, then rewrites; creates the tab if missing.
- createTabOnce_(name, rows): only the setup tabs above. Does nothing if the tab exists.
- appendRows_(name, rows): only Seating history, Waiter history and SM Run log.
- Make practice data has its own helper, which refuses to run if Students or Faculty has any data.

# Reading the tabs

Find every column by a keyword in its header, never by column letter, because exports change. To match: collapse runs of spaces and line breaks to one space and ignore case. A header that equals the keyword wins; otherwise look for the keyword inside the header. Keywords live in Event (rows named "Column: <tab> <name>"), so a renamed header needs no code change. A required keyword that matches no header, or more than one when none equals it, stops the menu item with a message naming the keyword, the tab and the headers it matched. An optional keyword that matches more than one header is treated the same way. Skip rows that are entirely blank. Turn every cell into text with String() and trim it. Read each tab with one getValues.

Students columns (keyword defaults; * = required):
- Email* (keyword "Email"): the ID.
- First name* ("First name"), Last name* ("Last name"), Preferred name ("Preferred"): the name shown everywhere is the preferred name if there is one, else the first name, then the last name.
- Form* ("Form"): any text (it might read "Senior", "VI Form", "12" or "2027"). Each distinct value is a form. The order forms are listed in comes from Event "Form order" (comma-separated); values not listed there come after, sorted.
- Gender ("Gender"), Boarding or day ("Boarding"), Dorm ("Dorm"), Advisory ("Advisory"), Sport ("Sport"), New student ("New student"): all optional. A missing optional column turns off any rule that needs it, and SM Check says "Not checked: no <column> column".
A student row with no email is still seated, with the ID "row:<row number>", and listed in SM Needs you ("No email, so history can't follow this student"). Two rows with the same email: keep the first, list the second in SM Needs you.

Faculty columns:
- Name* ("Your name"), Email ("Email Address", the column Google Forms adds when it collects emails).
- Attending ("attend"): blank or anything starting with Y means yes; anything starting with N means not coming.
- Guests ("How many guests"): a whole number of extra seats (a spouse who doesn't work here, a child). Blank is 0.
- Guest names ("Guest names"): shown on SM By table.
- Household ("spouse or partner"): the name or email of a spouse or partner who also works here. When either of two faculty names the other, they sit at the same table as one unit.
- Sit with ("sit with"): up to three names or emails of other faculty, separated by commas.
- New ("new to Pomfret"): Yes means new this year. Mentor ("new colleague"): Yes means happy to sit with a new colleague.
- Group ("advisory or team"): for the Together sort below, the value of the grouping column this adult belongs with (their advisory, the team they coach).
Names in Household and Sit with are matched to the Faculty tab like Past event names below (email first, then name words). An entry naming nobody, or more than one person, goes in SM Needs you.

The faculty Google Form uses these question titles, so the default keywords match. The README lists them under "Suggested faculty form questions":
1. Your name
2. Will you attend this seated meal? (Yes / No)
3. How many guests will you bring? (a spouse or partner who doesn't work at Pomfret, a child; 0 if none)
4. Guest names
5. If your spouse or partner also works at Pomfret, what's their name?
6. Who would you like to sit with? Up to three colleagues, separated by commas.
7. Are you new to Pomfret this year? (Yes / No)
8. Would you be happy to sit with a new colleague? (Yes / No)
9. If this dinner is seated by advisory or team, which advisory or team should you sit with?
The form also collects email addresses (Settings > Responses > Collect email addresses), which adds the Email Address column.

# Event settings (Event tab defaults)

- Event name: Candlelight
- Date: 2026-12-15
- Sort: Mixed (Mixed or Together)
- Together by: Advisory (the Students column to group by when Sort is Together)
- Seats per table: 10 (a Tables row's Seats overrides it)
- Adults per table: 2
- Waiters per table: 1
- Assistants per table: 1
- Waiter forms: All (or a comma-separated list of forms who can wait)
- Assistant forms: All
- Form order: Senior, Junior, Sophomore, Freshman
- Seed: 1 (change it to get a different arrangement under the same rules)
- Column: <tab> <name> rows for every keyword above (for example "Column: Students First name" with the value "First name").
A missing or unreadable value falls back to its default, with a warning in the finish message. Words people type (Yes, No, Mixed, Together, All, form names) are read ignoring case and spaces at the ends.

# Tables (Tables tab defaults)

47 rows, Table 1 to 47, with Row A to E from the room map, In use Yes for 1 to 46 and No for 47, and Seats blank (the Event default applies). The tool seats people only at tables In use. Neighbors are consecutive numbers with the same Row.

# Rules (Rules tab defaults, in rank order)

Rank | Rule | On | Value
1 | At least this many forms at each table | Yes | 3
2 | At most this many students from one form at a table | Yes | 3
3 | Nobody sits with a tablemate from the last event | Yes |
4 | Each table has a student who has waited before | Yes |
5 | Split groups sit at neighboring tables | Yes |
6 | Gender mixed: no table with exactly one student of a gender | No |
7 | Boarders and day students mixed at every table | No |
8 | Students not at the same table number as last event | Yes |
9 | Faculty not at the same table number as last event | Yes |

He can turn rules on or off, change values, and reorder ranks. Rank 1 matters most. A rule that needs data that isn't there (no Gender column, no history yet) is skipped and SM Check says why. Rule 5 applies only to the Together sort; rules 1 and 2 only to Mixed. "The last event" is the most recent Date in Seating history before this event's Date.

Hard limits, never broken by the sort and never on the Rules tab: everyone attending gets exactly one seat; no table holds more people than its Seats; every table in use gets at least one adult when there are enough adults; household members and guests sit at their faculty member's table; Locked seats are honored.

# Sort

If SM Seating exists, first ask: "This replaces SM Seating and the shared tabs, including changes made by hand. Rows in Locked seats stay put. Continue?" Then ask: "Who is running this, and why? (goes in SM Run log)". The answer is required. Cancel at either step changes nothing.

Ties are always broken with a fixed shuffle: FNV-1a of the Seed and the person's ID (the same idea as case-f-project-pomfret's tie order). Never the alphabet, never Math.random.

1. Who's coming. Students on the Students tab minus Not attending (matched by email, or by name when the email is blank). Faculty with Attending not No. Units: a household is one unit; each adult's guests travel with them.
2. Locked seats first. A lock to a table not in use, or one that overfills a table, goes in SM Needs you and is skipped.
3. Faculty. Spread adult units so each table gets close to Adults per table adults, filling tables evenly. In order: households, then new faculty each with a mentor at their table, then Sit with requests (seat requested pairs together when a table has room and no other adult rule breaks), then everyone else in shuffle order. With rule 9 on, prefer a table other than the one they had last event. Fewer adults than tables: tables without an adult are listed in SM Check.
4. Seats left for students at each table = its Seats minus its adults and guests. Spread students so every table's total is as even as possible (the most and least full tables differ by at most one person, unless locks or seats force otherwise).
5. Students, Mixed sort. Deal each form in Form order, students within a form in shuffle order, each to the table with the fewest students of that form, ties to the table with the most seats left, then by a rotating start table set by the Seed (so table 1 isn't always first).
6. Students, Together sort. Group students by the Together by column (blank values form their own group, "No <column>"). Faculty whose Group matches sit with that group. Groups larger than one table are split into as few tables as possible, and the tables are consecutive neighbors in one row, walking rows A to E. Then the remaining groups fill the remaining seats largest first, each kept whole when it fits (first fit, by room order). A group that has to split across rows goes in SM Check.
7. Better seats. Repeat until a round changes nothing, at most 100 rounds: try swapping two students at different tables (and moving a student to a table with a free seat). Keep a change only if it makes the rule results better by rank: compare the number of violations of the highest-ranked rule that's on; only if that's equal, the next; and so on. Never break a hard limit, never move a locked student. Go through students in shuffle order so the result is the same every run.
8. Waiters. At each table, pick Waiters per table students from the forms in Waiter forms, then Assistants per table from Assistant forms (a student has one role at most). Pick the student who has waited the fewest times this school year (Waiter history from August 1 on, both roles counted), then one who didn't wait at the last event, then shuffle order. A table with no eligible student gets no waiter and goes in SM Check. Rule 4 checks that every table has at least one student with any waiting in Waiter history (in the waiter role or not); when it fails, step 7's swaps try to fix it first, so run step 8 again after any swap round that touched it.
9. Write every SM tab and add the SM Run log row. Finish with: "Seated N students and F faculty at T tables. C rules not fully met. Read SM Check, then SM Needs you. When it looks right, share the four shared tabs."

Sort on 360 students and 95 faculty must finish in under 30 seconds in Apps Script (it stops scripts at 6 minutes) and under 5 seconds in the Node tests. Keep per-table counts in memory and update them on each swap instead of recounting.

# Sort again with a new shuffle

Adds 1 to the Seed in Event, then runs Sort (with the same two questions). This is how he gets a different arrangement under the same rules.

# Outputs

- SM Seating: Table | Name | Kind (Student, Faculty, Guest) | Form | Role (Waiter, Assistant, or blank) | Email | Locked (Yes or blank) | Why (one line: "Dealt by form", "Advisory: Example Group 4", "Household with Jane Example", "Locked: <why>", "Swapped to meet rule 3"). Sorted by table, then adults first, then by name. The note at the top says: "Edit the Table or Role column here, then run Check again. Sort again replaces this tab; to keep a seat, add it to Locked seats."
- SM By table: one block per table in use, in table order: the table number as a bold row, then the adults (with "(guest of <name>)" or guest names), then the students with form and role. A blank row between tables. Print-friendly: no extra columns.
- SM By first name: students only, sorted by shown first name, then last name: First | Last | Form | Table | Role.
- SM By form: students by form in Form order, then by last name: Form | Last | First | Table | Role, with a bold row at the start of each form.
- SM Faculty: adults sorted by last name: Name | Table | Guests.
- SM Check: Rule | Result (Pass, Warning, Fail, Not checked) | Details (the exact tables and people). One row per hard limit, then one per rule in rank order, then: waiters per form this event and this year (so he can see fairness at a glance), tables without a waiter, and anything Sort couldn't do.
- SM Needs you: rows that need a person, by section: data problems (no email, duplicate email, unknown Sit with or Household names), lock problems, people Sort couldn't seat, tables without an adult.
- SM Run log: Time | Who and why | Event | Date | Sort | Seed | Rules as used (short text) | Students | Faculty | Tables | Rules not fully met.

Bold every header row and freeze it. Text that starts with =, +, - or @ is written with a leading apostrophe.

# Check again

For after someone edits SM Seating by hand. It reads Students, Faculty, Tables, Event, Rules and the history tabs fresh, reads SM Seating as the truth (columns found by header; a table number that isn't in use, or a person who isn't attending, is a failure naming the row), and rebuilds SM Check, SM Needs you and the four shared tabs from it. It never changes SM Seating and never moves anyone. Finish: "Checked: F failures, W warnings. Read SM Check."

# Save this event to history

After the dinner (or once the list is final), this appends every seated person in SM Seating to Seating history and every waiter and assistant to Waiter history, with the Event name and Date. If that Event name and Date are already in history, it asks before replacing those rows (the only time history rows are removed). Finish: "Saved N seats and W waiters to history. The next Sort will use them."

# Add a past event to history

So the tool knows who waited and who sat together before it existed. A person pastes one past seating list into a tab named Past event: at least a Name column and a Table column, optionally Email and a Role or Waiter column. The menu item asks for the event's name and date, then matches each row to Students: by email when there is one; otherwise by name, comparing lowercase words with punctuation and anything in parentheses dropped, first trying shown first name plus last name, then legal first name plus last name, then the two words in either order, then last name plus first initial when exactly one student matches. Rows that match nobody, or more than one student, go in SM Needs you with the closest candidates; nothing is added for them until someone types the right email into the Past event row and runs it again. Matched rows are appended to the history tabs. Finish with how many matched and how many need a person.

# Make practice data

Writes made-up Students, Faculty and Not attending tabs into an otherwise empty spreadsheet (its own helper; it refuses if Students or Faculty has data), plus the setup tabs with defaults. Seeded (for example mulberry32 with a fixed seed), so it's identical every time; the Node tests use the same generator. Obviously invented names ("Avery Testwood"), emails at @example.org. About 350 students across the four forms (about 88 each), 92 faculty, the default 46 tables in use.

Plant on purpose: about 25 students in Not attending; preferred names; a student with no email; a duplicate email; a form value not in Form order; gender M and F with a few other values and blanks; about 30 percent day students and the rest in 12 dorms; 44 advisories of 7 to 9 students, each with a faculty Group; 20 sports, including one team larger than two tables; 3 couples (Household); 4 faculty bringing 1 or 2 guests; 4 new faculty and 6 mentors; Sit with requests including three people who all name each other and one naming someone not on the list; 8 faculty not attending. Also a Past event tab and history for two made-up past dinners in which some names drift (a preferred name, a misspelled last name, first and last swapped, one student who matches nobody), so the importer and the repeat rules have something to work on.

Don't tune the generator to force outcomes. Cases that need special numbers (fewer adults than tables, a table with no eligible waiter, a lock to a full table) get small fixtures of their own in the tests.

# Code layout (copy what fits from case-f-project-pomfret)

Clone https://github.com/CivicAIClub/case-f-project-pomfret into a folder next to this repo (read only) and reuse its structure: shared logic in core/, a thin Sheets adapter in apps-script/, one generated paste file, tests against a fake spreadsheet, and CI that checks the paste file is up to date. Copy its tests/helpers/fake-spreadsheet.cjs and its tie-order fingerprint idea and adapt them. Don't copy its project rules; this is a different problem.

- core/read.js: column matching, reading and checking Students, Faculty, Tables, Event, Rules, Not attending, Locked seats and history into plain objects.
- core/seat.js: steps 1 to 8 of Sort, the rules and their checks. No Sheets calls.
- core/history.js: the past-event name matching and history summaries.
- core/output.js: the rows for every SM tab.
- core/practice.js: the practice data generator.
- apps-script/Main.gs: the menu, menu handlers, reading tabs, the write helpers and the messages. The only file that touches SpreadsheetApp.
- scripts/build-apps-script.cjs: copies each core file into apps-script/ as a generated .gs file and joins everything into paste-into-apps-script/SeatedMeals.gs (committed), starting with /** @OnlyCurrentDoc */ and a comment saying it's generated.
- scripts/demo.cjs: npm run demo runs Make practice data, Sort, Check again and Save to history against the fake spreadsheet, writes every SM tab as CSV into demo-output/ (gitignored), and prints SM Check.
- tests/*.test.cjs with node:test and node:assert, and tests/helpers/.
- package.json: "test" runs node --test "tests/*.test.cjs"; "bundle", "demo"; Node 22 or newer; no dependencies.
- .github/workflows/test.yml: npm test, npm run demo and the bundle-is-current check on every pull request (Node 22).
- .gitattributes with "* text=auto eol=lf".

Plain-English comments in every file: what each function does and why. The team must be able to explain every file.

# Apps Script details that matter

- Put /** @OnlyCurrentDoc */ at the top of Main.gs and of the paste file, so the script can only touch its own spreadsheet.
- All .gs files share one global scope. At the top level of every file use only function declarations and var (wrap each core module in one var, as Case F does). Names are unique across files.
- Menu handlers can't end in an underscore. Helpers that shouldn't be run from the editor do.
- Read each tab with one getValues and write each with one setValues. Never call the Spreadsheet service inside a loop over people. Pad every row to the same width before setValues.
- Plain, older-style JavaScript that Apps Script surely runs: no optional chaining (?.), no ??, no class fields, and none of Object.groupBy, .toSorted(, .findLast(, .at(, .replaceAll( or structuredClone. No Node or browser globals in core/ or apps-script/.
- Dates: detect with Object.prototype.toString.call(value) === "[object Date]", never instanceof Date. Use Utilities.formatDate with Session.getScriptTimeZone() for the run log. Nothing else depends on the clock or on Math.random.

# Tests

- read: keywords on messy headers; a missing required keyword stops and names it; optional columns missing turn rules off; preferred names; no email; duplicate email; unknown form value ordering; Attending, Guests and Household parsing; words read ignoring case.
- seat: everyone attending seated exactly once; no table over its Seats; table totals within one of each other; locks honored and bad locks reported; households and guests together; a new faculty member seated with a mentor; Mixed meets rules 1 and 2 on the practice data (every table with at least 3 forms, at most 3 from one form), matching his 2026 baseline; Together keeps groups whole when they fit and puts a split group at neighboring tables in one row; rule ranking (a swap that helps rule 3 but breaks rule 1 is refused); rule 3 and rule 8 reduce repeats against seeded history compared with the same sort with those rules off; the same input and Seed twice gives identical seating; a different Seed gives a different seating; Sort on the practice data runs in under 5 seconds.
- waiters: one waiter and one assistant per table by default; nobody gets both; Waiter forms respected; fewest times waited goes first; nobody who waited at the last event is picked when someone else can be; never the alphabet (on practice data, waiters' last initials are spread across the alphabet); a table with no eligible student is reported; rule 4 fixed by a swap when possible.
- history: the importer matches by email, preferred name, legal name, swapped order and initial; refuses two candidates; lists the closest candidates for an unmatched row; Save to history twice asks before replacing.
- output: the four shared tabs contain only their listed columns (assert the headers, so gender, dorm, advisory, sport and email can never leak into them); SM By table blocks and guest lines; Check again catches a planted hand edit (a table over its Seats, a person at a table not in use, someone seated twice); a leading = gets an apostrophe.
- practice: identical on two runs; every planted case is there.
- e2e, against the fake spreadsheet, loading the paste file: Make practice data, Add a past event to history, Sort, Check again after a hand edit, Save to history, Sort again with a new shuffle; Sort asks before replacing SM Seating and Cancel changes nothing; writeTab_("Students"), createTabOnce_("Faculty") and appendRows_("SM Seating") all throw.
- safety: reads every core and .gs file and the paste file, strips comments, and fails, naming the file and line, if it finds UrlFetchApp, MailApp, GmailApp, DriveApp, DocumentApp, FormApp, PropertiesService, http://, https://, fetch(, the Node or browser globals or newer methods listed above, SpreadsheetApp outside Main.gs, or a write method (setValue, setValues, appendRow, clear, clearContents, clearFormats, deleteRow, deleteRows, insertSheet, deleteSheet) outside the write helpers. It also scans every tracked file (git ls-files) for the school's email domain and for Google Docs or Sheets links; build both patterns from pieces ("@" + "pomfret.org" and "docs." + "google.com") so the test doesn't flag itself.
- bundle: the committed paste file matches what npm run bundle writes (line endings normalized).

# Milestones

Do them in order. After each: npm test passes, commit with a plain-English message, push, and tick it in docs/decisions.md.

1. Context. Replace .cursor/rules/case-g-seated-meals.mdc (keep alwaysApply: true) and update AGENTS.md with the current picture: client Mr. Gibbs, Associate Head of School; team Christoph Ortenburg (lead developer), Abdul Hakim Al Khamisi, Lexi Godwin and Logan Lee, with Cayden Auyang (president) leading the client meetings and Luke Ryan (vice president); remove "Club lead" and the old lead developer line; status "building the first version for Candlelight, Dec 15, 2026"; the safety rules; "the full spec is docs/spec.md". Make sure docs/spec.md holds this text unchanged. Create docs/decisions.md with the milestone checklist, a "Calls I made" list and the Done checklist. Add package.json, the CI workflow, .gitattributes, demo-output/ in .gitignore, the fake spreadsheet helper and a first smoke test.
2. core/read.js, the setup tabs with defaults, Main.gs reading and write helpers, and core/practice.js with Make practice data. Tests.
3. core/seat.js steps 1 to 5 and 7 (faculty, students, Mixed sort, better seats, all rules). Tests.
4. Waiters (step 8) and history reading. Tests.
5. core/output.js, every SM tab, the Sort menu item end to end, Sort again with a new shuffle. Tests.
6. Check again. Tests.
7. Save this event to history and Add a past event to history. Tests. (Milestones 1 to 7 are the Candlelight version.)
8. The Together sort (step 6) with neighboring tables. Tests.
9. scripts/build-apps-script.cjs, scripts/demo.cjs, the e2e, safety and bundle tests. Run npm run demo and read SM Check and SM By table as Mr. Gibbs would: fix anything that looks wrong.
10. README: fill in the top table (client, developers as in milestone 1, status), The problem, Goal, Stack (Google Sheets and Apps Script; no AI, no network), How it works (one short paragraph per menu item and per rule), Suggested faculty form questions, Running it (below), Student data, Repository layout and Definition of done. Then the Done checklist, then the pull request.

README "Running it" has two parts.
Practice run, in a scratch spreadsheet: create a blank Google Sheet; Extensions > Apps Script; delete what's in Code.gs and paste the whole of paste-into-apps-script/SeatedMeals.gs; save; reload the spreadsheet; Seated Meals > Make practice data (the first run asks for permission: Review permissions, pick your account, Advanced, Go to the project (unsafe), Allow; it's your own script); then Add a past event to history, Sort, and what to look at after each.
Real run: make the working spreadsheet in the school account; copy in the student export as a tab named Students and the faculty responses as a tab named Faculty; set Event (name, date, sort, waiter forms) and Tables (which tables are set); list absences in Not attending; paste the script the same way; add the last two dinners with Add a past event to history; Sort; read SM Check and SM Needs you; edit SM Seating by hand if needed and run Check again; share only the four shared tabs (File > Make a copy of just those tabs, or move the rest to a private copy); after the dinner, Save this event to history. Never edit the original export; to get help from someone outside the school, describe the problem with made-up names.

Definition of done (Phase 1), for the README: the tool seats the real Candlelight lists in the working spreadsheet; SM Check passes, or every failure has a one-sentence explanation for Mr. Gibbs; waiters are picked fairly with history recorded; npm test passes in CI, including the safety test; Mr. Gibbs has the lists to review by December 8, 2026.

# Done checklist

Check each one yourself before you stop, and fix anything that fails:
- npm test passes locally, and every test file above exists.
- npm run demo runs the whole flow on practice data with no errors. In its SM Check, every failure is one you planted on purpose, and every warning is planted or explained in one sentence.
- Sorting the practice data twice with the same Seed gives identical SM tabs (apart from the run log time).
- paste-into-apps-script/SeatedMeals.gs is up to date and starts with /** @OnlyCurrentDoc */.
- The four shared tabs show only names, form, table, role and guests.
- No real names, emails, links or spreadsheet IDs anywhere in the branch. Practice emails end in @example.org.
- No TODO, FIXME or placeholder logic in core/ or apps-script/.
- docs/spec.md is this text, unchanged. docs/decisions.md lists every call you made. The README, AGENTS.md and the Cursor rule agree with both.
- The PR is open into main, titled "Seated meals tool: first version for Candlelight", with the template filled in, and not merged. If gh isn't logged in, the branch is pushed and you have the compare link. If pushing failed, everything is committed locally and you say so.
- No Co-authored-by, Generated with, Made-with or any other AI attribution line in any commit message or the PR.

# When you stop

Plain English, short:
1. What's in the PR, the npm test summary line, and whether every push worked.
2. SM Check from npm run demo (practice data only), and what each failure or warning shows.
3. A 10-minute check in Google Sheets on practice data, step by step, with what the person should see: paste the script into a scratch spreadsheet, Make practice data, Add a past event to history, Sort, one table in SM By table explained, SM Check, then move one student by hand in SM Seating and run Check again.
4. Every call you made that Cayden or Mr. Gibbs should check (from docs/decisions.md), especially anything about waiters, faculty seating and the default rules.
5. What the first real run needs, in order.
