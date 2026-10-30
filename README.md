# Case G: Seated Meals

## What this is

Mr. Gibbs, Associate Head of School at Pomfret School, is the client for this case. Building seated meal table lists and waiter assignments by hand from student data in Sundial is slow, and he does it monthly or once a term. The first meeting is being scheduled, so there is no code yet. Status: first meeting being scheduled.

| | |
|---|---|
| **Client** | Mr. Gibbs, Associate Head of School, Pomfret School |
| **Developers** | Abdul Hakim Al Khamisi, Lexi Godwin, Logan Lee, Keke Li (lead developer), Luke Ryan (vice president) |
| **Club lead** | Cayden Auyang |
| **Status** | 🔵 First meeting being scheduled |

## The problem

Mr. Gibbs builds seated meal table lists and waiter assignments from student data in Sundial, and doing it by hand is slow. He does it monthly or once a term.

How tables are balanced, how waiters rotate, and what the finished lists look like: _To be written in the first meeting._

## Goal

_To be written in the first meeting._ Likely direction (not a commitment): balancing tables and rotating waiters is a puzzle with clear rules, so the finished tool may not need AI at all.

## Stack

_Not decided._ Prefer Google Workspace (Sheets, Apps Script). Decide in the first meeting and record the decision here and in `.cursor/rules/case-g-seated-meals.mdc`.

## Student data

This repository is public. Nobody at Pomfret has Sundial API access (see the [case-d-roster-export README](https://github.com/CivicAIClub/case-d-roster-export#readme)), so student lists would come from an export his office runs inside the school's own account. Never commit real names, tables or exports. Build and test with made-up students only.

## Repository layout

```
case-g-seated-meals/
├── README.md              ← this file; keep it the source of truth for setup
├── .cursor/rules/         ← committed Cursor rules (workflow + project context)
├── .github/               ← pull request template, CODEOWNERS
└── .gitignore
```

Add code at the repo root (no `projects/` folder). When you add a real setup, write a "Setup from a fresh clone" section here: install, env vars (with a `.env.example`), run, build.

## Working on this repo

- Branch from `main` as `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>` (lowercase, hyphens).
- Every change goes through a pull request with at least one approval. `main` cannot be pushed to directly.
- Never commit secrets. Put real values in a gitignored `.env`; list variable names with placeholders in `.env.example`.
- Cursor rules for this project are committed in `.cursor/rules/`. You do not need to paste anything into your IDE settings.
- The full Git walkthrough for beginners is the club's **[Developer Onboarding Guide](https://github.com/CivicAIClub/docs/blob/main/developer-onboarding.md)**.

## Definition of done (Phase 1)

_To be written in the first meeting._

## Contributors

- **Cayden Auyang:** club lead; set up this repository
- Developers: not yet assigned
