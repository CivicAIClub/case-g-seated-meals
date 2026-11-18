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
- [ ] 8. The Together sort with neighboring tables
- [ ] 9. Bundle script, demo script, e2e, safety and bundle tests, demo read as Mr. Gibbs would
- [ ] 10. README, Done checklist, pull request

## Calls I made

## Done checklist

- [ ] npm test passes locally, and every test file in the spec exists.
- [ ] npm run demo runs the whole flow on practice data with no errors; every SM Check failure is planted, every warning planted or explained.
- [ ] Sorting the practice data twice with the same Seed gives identical SM tabs (apart from the run log time).
- [ ] paste-into-apps-script/SeatedMeals.gs is up to date and starts with /** @OnlyCurrentDoc */.
- [ ] The four shared tabs show only names, form, table, role and guests.
- [ ] No real names, emails, links or spreadsheet IDs anywhere in the branch. Practice emails end in @example.org.
- [ ] No TODO, FIXME or placeholder logic in core/ or apps-script/.
- [ ] docs/spec.md is unchanged. This file lists every call. The README, AGENTS.md and the Cursor rule agree with both.
- [ ] The PR is open into main, titled "Seated meals tool: first version for Candlelight", template filled in, not merged.
- [ ] No Co-authored-by, Generated with, Made-with or any other AI attribution line in any commit message or the PR.
