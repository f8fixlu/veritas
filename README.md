# Veritas

Online exam system built with Next.js — self-hostable, backed by SQLite.

## System Overview

Veritas is a multiple-choice online examination platform with two roles:

**Admins** manage the catalog: create **subjects**, enroll students into them,
and build **exams** out of four-option (A–D) multiple-choice questions. Each
exam has a time limit, an optional **randomize** toggle (each student gets
their own shuffled order), and optional named **sections** ("Part I",
"Prelim"…) that carry their own details and **points per question** —
questions without a section use the exam-wide default. Questions can be
written manually, imported from Excel/CSV (missing sections are created
automatically, rows are appended or replace existing ones by choice), or
copied from another exam into a chosen section; every question stays editable
afterwards. Exams stay in draft until published, and results stay hidden
until the admin explicitly releases them.

**Students** register themselves (name, email, password, gender), see only the
published exams of subjects they are enrolled in — including each exam's
section breakdown and points — and take them under a per-exam time limit.
Section headings appear before each block of questions, unanswered items get a
red outline, and submitting warns about any unanswered items first. Answers
are auto-saved; grading is automatic and weighted per section.

**Admins also get reporting**: a per-exam report with completion stats, a
leaderboard (medals for the top 3, ties broken by earliest submission), a
roster grouped by subject → gender, live answered/unanswered counters for
attempts in progress, and one-click printing (print-friendly layout).

Technically it's a single Next.js app (App Router) serving both pages and a
JSON API, sessions signed with `AUTH_SECRET`, passwords hashed with bcrypt,
and one SQLite file as the whole database — no external services required.

## Getting Started

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build the production bundle |
| `npm start` | Serve the production build (`-p PORT` for a custom port) |
| `npm run seed` | Seed the admin account (idempotent) |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Full production deployment (see below) |
| `npm run publish` | Commit & push the source to GitHub (see below) |

### Deploy — `scripts/deploy.sh` / `deploy.ps1`

One command that takes a fresh checkout (or an existing install) to a running
production server:

```bash
npm run deploy
```

It checks the Node version (≥ 20.9), loads or creates `.env`
(`AUTH_SECRET`), runs `npm ci` if needed, applies the Prisma schema
(`prisma db push`), seeds the admin account, builds, and starts on port 3000.

Flags (pass after `--` so npm forwards them):

```bash
npm run deploy -- -Port 8080   # serve on a custom port
npm run deploy -- -InitEnv     # first run: generate .env with a random AUTH_SECRET
npm run deploy -- -Fresh       # force dependency reinstall
npm run deploy -- -NoStart     # prepare everything but don't start the server
```

On Linux/macOS this runs `scripts/deploy.sh`; on Windows a launcher picks
`scripts/deploy.ps1`. See [prod.md](./prod.md) for the full production guide
(process manager setup, reverse proxy/HTTPS, backups).

### Publish — `scripts/publish.sh` / `publish.ps1`

Commits all changes and pushes the source to GitHub
(`github.com/f8fixlu/veritas`):

```bash
npm run publish                                  # prompts for a commit message
npm run publish -- -Message "Fix grading bug"    # commit message inline
npm run publish -- -DryRun                       # preview what would run
```

It verifies your git identity is configured, stages everything
(`git add -A`, respecting `.gitignore`), commits, points `origin` at the
Veritas repository, renames the current branch to `main`, and pushes.
If credentials are missing it fails fast and suggests `gh auth login`.

## Project Structure

```
veritas/
├── prisma/
│   ├── schema.prisma        # Data model: User, Subject, Enrollment, Exam,
│   │                        # ExamSection, Question, Attempt, Answer
│   └── dev.db               # SQLite database (all app data lives here)
├── public/                  # Static assets
├── scripts/
│   ├── seed.ts              # Creates the admin account (npm run seed)
│   ├── deploy.sh / .ps1     # Production deployment (see Deploy above)
│   ├── publish.sh / .ps1    # GitHub publishing (see Publish above)
│   └── run.js               # Cross-platform launcher for deploy/publish
└── src/
    ├── app/                 # Next.js App Router: pages + API routes
    │   ├── admin/           # Admin panel (subjects, exams, students)
    │   │   └── exams/[id]/report/  # Per-exam report: stats, leaderboard,
    │   │                           # gender-grouped roster, print support
    │   ├── dashboard/       # Student dashboard (available exams w/ section
    │   │                    # breakdown, results)
    │   ├── exam/[id]/       # Exam start page
    │   ├── attempt/[id]/    # Attempt in progress (per-section question
    │   │                    # blocks, unanswered highlighting)
    │   ├── result(s)/       # Score views
    │   ├── login|register/  # Auth pages (register collects gender)
    │   └── api/
    │           ├── auth/        # login, logout, register
    │           ├── exams/       # student-facing exam & attempt endpoints
    │           ├── attempts/[id]/save|submit  # auto-save & grading
    │           └── admin/
    │               ├── subjects/            # incl. enrollments
    │               ├── exams/[id]/          # CRUD + sections + questions +
    │               │                        # import (file) + import-exam
    │               │                        # (copy from another exam)
    │               ├── attempts/[id]/progress  # live answered/unanswered
    │               └── questions/[id]       # edit / delete questions
    ├── components/
    │   ├── admin/           # Forms & panels: settings, sections editor,
    │   │                    # import panel (+ from-exam), question form &
    │   │                    # edit modal, report print button, live progress
    │   ├── student/         # Exam runner (section headers, unanswered
    │   │                    # warnings), start button
    │   └── *.tsx            # Shared: nav bar, modals, user menu
    ├── lib/
    │   ├── auth.ts          # Session handling (JWT via AUTH_SECRET)
    │   ├── db.ts            # Prisma client singleton
    │   ├── exam.ts          # Exam/attempt logic: per-section weighted
    │   │                    # grading, timeout finalization, seeded shuffle
    │   └── format.ts        # Formatting helpers
    └── generated/prisma/    # Generated Prisma client (gitignored;
                             # recreated by `prisma generate` on npm ci)
```
