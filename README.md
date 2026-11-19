# Case G: Seated Meals

## What this is

A tool in Google Sheets for the school's seated meals: formal dinners where every student and the attending faculty sit at assigned round tables, and some students wait on their table. For each event it seats the faculty (with spouses and children who come along), seats every student by rules Mr. Gibbs picks and ranks, picks each table's waiter fairly across the year, checks every rule, and writes the tabs he already sends out. He reviews and edits the result by hand; the tool never has the last word.

| | |
|---|---|
| **Client** | Mr. Gibbs, Associate Head of School, Pomfret School |
| **Developers** | Christoph Ortenburg (lead developer), Abdul Hakim Al Khamisi, Lexi Godwin, Logan Lee |
| **Client meetings** | Cayden Auyang (president); Luke Ryan (vice president) |
| **Status** | 🟡 Building the first version for Candlelight, Dec 15, 2026 |

The full spec is [`docs/spec.md`](docs/spec.md). Calls made while building it are in [`docs/decisions.md`](docs/decisions.md); where the two differ, the decisions file wins.

## The problem

Mr. Gibbs builds every seating list by hand in a spreadsheet, with data sorts, shifting the table numbering each time so the lists come out different. It is slow, he can't track who has waited or who sat together last time, and he would hold more seated meals if it were easier. Earlier dinners dealt students alphabetically, which once put six juniors and one sophomore at one table, and picked waiters by the alphabet too (most waiters had last names A to G). His best method so far (September 2026) dealt each form separately, so every table had all four forms and at most 3 students from one form. That is the baseline the tool has to match or beat.

## Goal

One click turns the student export and the faculty form into table lists that meet his rules, with fair waiters tracked over the year and no repeat tablemates at back-to-back events, in the same tabs he sends today. First use: Candlelight on Tuesday, Dec 15, 2026, with the lists in his hands by Dec 8 for review.

## Stack

Google Sheets and Apps Script (plain JavaScript), pasted into the working spreadsheet. No AI, no model calls, no network, no new dependencies. Same input and same Seed, same output, every time. Tests and scripts run in plain Node 22 or newer.

## How it works

Everything is under the **Seated Meals** menu in the spreadsheet. Each menu item first creates any missing setup tab (Event, Rules, Tables, Not attending, Locked seats, Seating history, Waiter history) with its defaults; it never overwrites one that exists. Every message says what happened and what to do next.

**Sort.** Reads Students, Faculty, Faculty list, the setup tabs and the history tabs. If SM Seating exists it first asks whether to replace it (rows in Locked seats stay put), then asks who is running it and why, for SM Run log; Cancel changes nothing. Then: who's coming (the current season's students minus Not attending, and the faculty who answered Yes), locked seats, the faculty (households first, then new faculty each with a mentor, then colleagues who asked for each other, then everyone else, close to Adults per table at every table), the students (Mixed deals each form across the tables; Together keeps a group at the same tables), better seats (swaps that improve the rules by rank), and waiters. It writes SM Seating, the four shared tabs, SM Check and SM Needs you, and adds a row to SM Run log. Ties are broken by a fixed shuffle from the Seed, never by the alphabet.

**Sort again with a new shuffle.** Adds 1 to the Seed in Event and runs Sort with the same two questions. This is how to get a different arrangement under the same rules.

**Check again.** For after someone edits SM Seating by hand (change the Table or Role column). It reads SM Seating as the truth, checks every hard limit and rule, and rebuilds SM Check, SM Needs you and the four shared tabs. It never moves anyone.

**Save this event to history.** After the dinner (or once the list is final), adds every seated student and faculty member to Seating history and every waiter and assistant to Waiter history, with the Event name and Date. If that event is already there, it asks before replacing it.

**Add a past event to history.** So the tool knows who waited and who sat together before it existed. Paste one past seating list into a tab named Past event: one row per person, with a Name column (or first and last name columns, which it joins) and a Table column, and optionally Email and Role or Waiter. Roles W and Waiter count as the waiter; AW, A, Asst and Assistant as the assistant. A table and a role in one cell ("12 W") work too. It asks for the event's name and date, then matches each row to Students (then to the faculty) by email, or by name: shown first name and last name, legal first name and last name, the two in either order, then last name and first initial. Rows that match nobody or more than one person go to SM Needs you with the closest names. Rows that match nobody are expected for people who graduated or left; for anyone still at the school, type their email into the Past event row and run it again (it asks before replacing).

**Make practice data.** Fills a blank spreadsheet with an invented school (about 350 made-up students in the real export's layout, the faculty form's answers, a Faculty list, absences, and a past dinner), so anyone can try the tool. It refuses to run if Students or Faculty has any data.

### Hard limits (never broken, and not on the Rules tab)

Everyone coming gets exactly one seat; no table holds more people than its Seats; every table in use gets at least one adult when there are enough; household members and guests sit at their faculty member's table; locked seats are honored.

### Rules (the Rules tab: turn on or off, change values, reorder ranks; rank 1 matters most)

1. **At least this many forms at each table** (3, Mixed sort only).
2. **At most this many students from one form at a table** (3, Mixed sort only).
3. **Nobody sits with a tablemate from the last event.** "The last event" is the latest date in Seating history before this event.
4. **Each table has a student who has waited before**, so no table of new students is left with nobody to show them how.
5. **Split groups sit at neighboring tables** (Together sort only). Neighbors are consecutive numbers in the same row of the room.
6. **Gender mixed: no table with exactly one student of a gender** (off by default; counts Female and Male; needs a Gender column).
7. **Boarders and day students mixed at every table** (off by default; needs a BoardingDay column).
8. **Students not at the same table number as last event.**
9. **Faculty not at the same table number as last event.**

A rule that needs data that isn't there (no history yet, no Gender column) is skipped, and SM Check says why. When two rules conflict, the higher-ranked one wins.

### The tabs

- **Filled in by people (the program never writes them):** Students, Faculty, Faculty list (optional), Past event (optional).
- **Setup (edited by people):** Event (event name, date, sort, seats, adults, waiters and assistants per table, which forms wait, Seed, column keywords), Rules, Tables (the 47 tables of the dining hall in rows A to E, which are in use, seats), Not attending, Locked seats, Seating history, Waiter history.
- **Written by the program:** SM Seating (the working list, one row per person), the four shared tabs SM By first name, SM By form, SM By table and SM Faculty (only names, form, table, role and guests), SM Check and SM Needs you (for the person running it), SM Run log (one row per Sort).

## The faculty form

The Candlelight faculty Google Form (already built in the school account) collects verified school emails and allows one answer per person, editable after submitting. Its responses tab is copied in as the Faculty tab. The tool reads these questions, by a keyword in each header:

1. **Email Address** (added by the form).
2. **Your name** (required).
3. **Will you attend this seated meal?** Yes or No (required). Blank or Yes means coming. People who answer No skip the rest.
4. **Will a spouse, partner or child join you? If so, who?** Names, split on commas, "and", "&" and line breaks. Answers that mean nobody ("No", "None", "N/A", "Just me") hold no seat, and "Yes" and words like "my wife" or "our kids" are dropped, so "Yes, my wife Sarah" is a guest named Sarah. A faculty member's name anywhere in the answer ("My husband John Smithson", or "my husband John" from Jane Smithson) makes the two a household (same table, no guest seat). A spouse on Faculty list who didn't fill in the form is seated with the person who named them; one who answered No is not seated. Other names are guests. Faculty who share a last name but didn't name each other are asked to sit together, like a colleague request.
5. **How many seats should we save for your guests?** 0 to 4. Never fewer seats than the guests question 4 names or mentions ("My wife Sarah and my son" is two; "My husband, John" is one). Left blank, it holds a seat for each of them, and at least one when the answer says someone is coming; SM Needs you says when the two answers disagree.
6. **Up to three colleagues you'd enjoy sitting with.** Names; "No preference", "Anyone" and the like ask for nobody, and unknown or unclear names go to SM Needs you. When someone is on Faculty list, the list's name is shown everywhere, and the name they typed into the form still matches.
7. **Are you new to Pomfret this year, or would you be glad to sit with a colleague who is?** "I'm new to Pomfret this year" or "I'd be glad to sit with a new colleague" or "Neither". New faculty sit with a mentor.

For each new event, make a copy of the form (File > Make a copy in Google Forms), so its answers start empty.

## Running it

### Practice run, in a scratch spreadsheet

1. Create a blank Google Sheet.
2. Extensions > Apps Script. Delete what's in Code.gs and paste the whole of [`paste-into-apps-script/SeatedMeals.gs`](paste-into-apps-script/SeatedMeals.gs). Save.
3. Reload the spreadsheet. A **Seated Meals** menu appears.
4. Seated Meals > **Make practice data**. The first run asks for permission: Review permissions, pick your account, Advanced, Go to the project (unsafe), Allow. It's your own script, and it can only touch this spreadsheet. You should see Students, Faculty, Faculty list, Not attending, Past event and the setup tabs.
5. Seated Meals > **Add a past event to history**, name "Practice dinner B", date 2026-11-10. It says how many rows matched; SM Needs you lists the two planted rows that don't (a misspelled name and a student who doesn't exist).
6. Seated Meals > **Sort**. Type who you are and why. It says how many students and faculty it seated. Read **SM Check** (every row should be Pass or Not checked) and **SM Needs you** (the planted data problems: a student with no email, a duplicate row, faculty who didn't answer, and so on). Look at one table in **SM By table**: two faculty, then about seven students from at least three forms, one Waiter and one Assistant.
7. In **SM Seating**, change one student's Table to another table and run **Check again**. SM Check still passes (or flags the table if you made it too full), and the shared tabs follow your edit.

### Real run, in the school's Google account

1. Make the working spreadsheet in the school account.
2. Download Mr. Sheehan's student file as CSV (File > Download > CSV) and import it as a tab named **Students** (or copy the tab in). Never edit the original export.
3. Link the faculty form to the working spreadsheet, so late answers show up on their own: in the form, Responses > Link to Sheets > Select existing spreadsheet, pick the working spreadsheet, then rename the new tab to **Faculty**. If that isn't possible, copy the responses tab in as **Faculty**. Add Mr. Gibbs's faculty list as **Faculty list** if there is one.
4. Paste the script the same way as the practice run, reload, and run any menu item once to create the setup tabs.
5. Set **Event** (name, date, sort, and Waiter forms and Assistant forms to the forms Mr. Gibbs picks for this dinner) and **Tables** (which tables are set for this dinner). List everyone who isn't on this dinner's list in **Not attending**.
6. Add the last two dinners with **Add a past event to history**, one at a time. For each one, make a **Past event** tab from his file: one row per person, with a Name column (or first and last name columns), Table, and Role if the file has one. Put the faculty rows under the students. Rows for people who graduated or left won't match, and that's expected.
7. **Sort.** The finish message names the season it used ("Students: used ..."); if the winter rosters are only partly in, set Season in Event to "Fall 2026 - 2027" and Sort again. Read **SM Check** and **SM Needs you**.
8. Edit **SM Seating** by hand if needed, then **Check again**.
9. Share only the four shared tabs. Google Sheets has no "copy just these tabs" item: right-click the **SM By first name** tab > Copy to > New spreadsheet, then copy the other three shared tabs into that same spreadsheet (Copy to > Existing spreadsheet), rename them, and share only that file.
10. After the dinner, **Save this event to history**.

To get help from someone outside the school, describe the problem with made-up names. Never paste real names, tables or exports anywhere else.

## Student data

This repository is public. Nobody working on the code sees the real data. The real run happens in Google Sheets, in the school's account, by a person. The student list is a Google Sheet that Mr. Gibbs and Mr. Sheehan built, which updates itself every hour: one row per student per season, with the headers FirstName, Nickname, LastName, Email, YOG, SchoolYear, TeamSeason, TeanName, AdvisorGroup, Gender, BoardingDay. Columns are found by a keyword in their header, so a renamed header only needs a "Column:" row in Event. The tool uses school email as the ID, keeps only the current season's rows, and names the forms from YOG and SchoolYear.

Everything in this repository is built and tested with made-up people only ("Avery Testwood", emails at @example.org). Never commit real names, tables, emails or exports, and never put a sheet link or spreadsheet ID in the repo.

## Setup from a fresh clone

```sh
git clone https://github.com/CivicAIClub/case-g-seated-meals.git
cd case-g-seated-meals
npm test          # all tests, Node 22 or newer, nothing to install
npm run demo      # the whole flow on practice data; writes demo-output/*.csv and prints SM Check
npm run bundle    # rebuilds paste-into-apps-script/SeatedMeals.gs after changing core/ or apps-script/Main.gs
```

There are no dependencies and no environment variables, so there is no `.env.example` yet. Add one the moment a credential or ID is needed.

## Repository layout

```
case-g-seated-meals/
├── core/                      ← the logic, no Sheets calls (shared by Apps Script and the tests)
│   ├── read.js                ← reading every tab: column keywords, students, faculty, settings
│   ├── seat.js                ← Sort steps 1 to 8, the rules and the checks
│   ├── history.js             ← the last event, waiting this year, the past-event importer
│   ├── output.js              ← the rows for every SM tab and the finish messages
│   └── practice.js            ← the practice data generator
├── apps-script/
│   ├── Main.gs                ← the menu, handlers and write helpers (the only file that touches Sheets)
│   └── *.gs                   ← generated copies of core/ (npm run bundle)
├── paste-into-apps-script/
│   └── SeatedMeals.gs         ← generated: the one file to paste into the Apps Script editor
├── scripts/
│   ├── build-apps-script.cjs  ← npm run bundle
│   └── demo.cjs               ← npm run demo
├── tests/                     ← npm test (node:test), with a fake spreadsheet in tests/helpers/
├── docs/
│   ├── spec.md                ← the build spec (never rewritten)
│   └── decisions.md           ← calls made while building
├── .cursor/rules/             ← committed Cursor rules (workflow and project context)
└── .github/                   ← pull request template, CODEOWNERS, CI (npm test, demo, bundle check)
```

## Working on this repo

- Branch from `main` as `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>` (lowercase, hyphens).
- Every change goes through a pull request with at least one approval. `main` cannot be pushed to directly.
- After changing `core/` or `apps-script/Main.gs`, run `npm run bundle` and commit the paste file; CI checks it is current.
- Never commit secrets. Put real values in a gitignored `.env`; list variable names with placeholders in `.env.example`.
- Cursor rules for this project are committed in `.cursor/rules/`. You do not need to paste anything into your IDE settings.
- The full Git walkthrough for beginners is the club's **[Developer Onboarding Guide](https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md)**.

## Definition of done (Phase 1)

- The tool seats the real Candlelight lists in the working spreadsheet.
- SM Check passes, or every failure has a one-sentence explanation for Mr. Gibbs.
- Waiters are picked fairly, with history recorded.
- `npm test` passes in CI, including the safety test.
- Mr. Gibbs has the lists to review by December 8, 2026.

## Contributors

- **Christoph Ortenburg:** lead developer
- **Abdul Hakim Al Khamisi, Lexi Godwin, Logan Lee:** developers
- **Cayden Auyang:** president; set up this repository and leads the client meetings
- **Luke Ryan:** vice president
