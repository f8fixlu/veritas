# AGENTS.md

Veritas — self-hosted exam system. Next.js 16 (App Router) + React 19 + Prisma 7 + SQLite (`better-sqlite3`), Tailwind 4. Single app (not a monorepo); all source under `src/`.

## Commands

```bash
npm ci            # install; postinstall runs `prisma generate`
npm run dev       # dev server on :3000
npm run lint      # ESLint only — the only check script
npm run seed      # create/reset default admin (idempotent): admin@veritas.local / admin123
npm run reset-admin
npx tsc --noEmit  # typecheck (no npm script; tsconfig has noEmit)
```

- **No test suite and no CI workflows exist.** Verify with `npm run lint` + `npx tsc --noEmit`, or `npm run build`.
- Node **22** (`.nvmrc`). `better-sqlite3` is ABI-bound: the Node that runs `npm ci` must be the Node that runs the app. After reinstalling deps, sanity-check: `node -e "require('better-sqlite3'); console.log('OK')"`.
- Path alias: `@/*` → `src/*`.

## Prisma / database

- Schema: `prisma/schema.prisma`. Client is generated into `src/generated/prisma` (**gitignored** — never edit files there; regenerate with `npx prisma generate`).
- **No `prisma/migrations/` directory** — apply schema changes with `npx prisma db push`, not `prisma migrate dev`.
- DB file: `VERITAS_DB_FILE` env or `prisma/dev.db` (gitignored). Access everything through `getDb()` in `src/lib/db.ts` (global singleton + better-sqlite3 adapter). **All CLI/app commands must see the same `VERITAS_DB_FILE`** — the Next server loads `.env`, the Prisma CLI does not (it is loaded in `prisma.config.ts`), and `update.sh`/`install.sh` re-source `.env` inside their `run_app`/`app_run` helpers. A mismatch migrates `prisma/dev.db` while the server reads the real file, leaving the live DB un-migrated.
- SQLite: no concurrent writers; keep the DB on local disk; back up with sqlite3 `.backup`.
- Roles are **plain strings** (`ADMIN | INSTRUCTOR | STUDENT`) on `User.role` — not Prisma enums (SQLite limitation). Staff = ADMIN or INSTRUCTOR (`isStaff()`).

## Auth conventions (`src/lib/auth.ts`)

Sessions are a JWT cookie `veritas_session` signed with `AUTH_SECRET` (required — production refuses to start without it; the dev fallback applies only outside production); each user has a `sessionVersion` bumped on login to revoke older sessions.

- **Pages (server components/actions):** `requireUser()` / `requireStaff()` / `requireAdmin()` — redirect on failure.
- **API routes:** `requireApiUser()` / `requireApiStaff()` / `requireApiAdmin()` — return `null` on failure; respond 401 yourself.
- Admin-only features (e.g. instructor management) use the Admin variants; most `/api/admin/*` routes use Staff.
- Unverified students are blocked from `requireUser`/`requireApiUser` (redirect to `/verify-required` or 401).
- **CSRF:** all mutating (`POST`/`PUT`/`PATCH`/`DELETE`) requests to `/api/*` are rejected 403 unless the `Origin` header matches the request `Host` — a global guard in `src/proxy.ts` (the Next 16 proxy/middleware). The reverse proxy must preserve the original `Host` header (the documented nginx/Caddy configs do). A **server-side** `fetch("/api/…")` carries no `Origin` and is blocked, so call the underlying logic directly instead of looping back over HTTP.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production (`sessionCookieOptions`), so production must be served over HTTPS — unless `VERITAS_COOKIE_SECURE=false` is set to deliberately allow the cookie over plain HTTP.

## Ownership scoping (`src/lib/scope.ts`)

Every subject has exactly one owner (an instructor) via `Subject.ownerId`; everything under it (exams, questions, attempts, snapshots, reports) inherits that owner. Subject names are unique **per owner** (`@@unique([ownerId, name])`), so two instructors can each have a "Biology".

- `isAdmin()` / `canManageContent()` — canManageContent is instructor-only; admins get delete-only access to content.
- `ownedSubjectWhere` / `ownedEnrollmentWhere` / `ownedExamWhere` / `ownedAttemptWhere` — Prisma `where` fragments to spread into queries. `ownedExamWhere` and `ownedAttemptWhere` go on the **exam/attempt** table; do not apply one where the other is expected.
- `ownedStudentWhere` / `unEnrolledStudentWhere` — students are **linked** to exactly one instructor via `User.instructorId` (set from the code they enter at registration). `ownedStudentWhere` scopes a query to the instructor's own students; `unEnrolledStudentWhere` adds "no enrollment in any of their subjects" (the newly-registered list). `searchStudents(user, query, excludeIds)` is the limited name/email lookup used by the enroll panel — it only searches the caller's own linked students, so instructors can never find (or enroll) another instructor's student.
- Use the helpers rather than hand-writing `ownerId`/`instructorId` comparisons, and return **404** for another owner's resource (403 only for a wrong role) so IDs don't leak. Enrolling a student who isn't `instructorId === user.id` is a 404 too.

Role split: admin manages instructors + the global student list and can delete any subject/exam, but cannot open subject, exam or report pages. Instructors see and change only their own content; students see their own results. Instructor deletion is refused (409) while they still own subjects **or have linked students** (admins re-assign via the Students page first).

## Subject enrollment tokens

Each subject has a 6-character enrollment code (`Subject.joinToken`, globally unique, uppercase — no 0/O/1/I). It is generated on subject create and regenerable by its owner (`POST /api/admin/subjects/[id]/join-token`). Students self-enroll:
`POST /api/subjects/join` with `{ token }` (student-only; 404 unknown token, 409 already enrolled). New schema fields on a populated DB: make the column nullable and fill via `scripts/backfill-subject-owners.ts` / `scripts/backfill-join-tokens.ts` / `scripts/backfill-student-codes.ts` (`npx tsx`), since there are no `prisma/migrations/`.

## Student ↔ instructor link

Every student is linked to exactly one instructor through `User.instructorId`, picked from the **instructor's personal code** (`User.studentCode`, same 6-char no-lookalike alphabet as subject tokens; generated at instructor create via `POST /api/admin/instructors`, regenerable by the owner via `POST /api/admin/me/student-code`). Registration (`POST /api/auth/register`) **requires** a valid `instructorCode` (400 if missing, 404 if unknown), so no new student can be unlinked. Legacy students keep `instructorId = null` and show up for the admin as "Unassigned" (`POST /api/admin/students/[id]/instructor` links them). Instructors see their own code on their overview page and share it with students; the admin sees every instructor's code on the Instructors page.

**Deleting students/instructors requires a password.** Any staff member deletes a student (`DELETE /api/admin/students/[id]`) only after re-entering **their own** password: the delete modal calls `POST /api/admin/verify-password` (returns `{ valid }`) and keeps the confirm button disabled until it's correct; the DELETE route re-verifies the submitted `{ password }` anyway (400 if missing, 401 if wrong). Admins can delete any student; an instructor can only delete a student linked to them (`instructorId === user.id`) — another instructor's student is a 404. Both roles also re-enter their password before removing an instructor account (`DELETE /api/admin/instructors/[id]`, admin-only).

## Design & layout standards

Consistency rules shared by every page — follow these when building or changing UI:

- **Form fields**: an input and its button must sit on the **same row, the same height**, vertically aligned (`flex items-center gap-3`; the button uses the plain `btn` size — not `btn-sm` — so its `py-2 text-sm` matches the `.input` height). The label goes on its own line above the control (`mt-1` between label and row).
- **Buttons**: `btn btn-primary/secondary/danger`; size variants are `btn-sm` (compact rows/lists/pagers) and the base `.btn` (inline form buttons). Never mix inline sizes within one aligned row.
- **Cards**: surface-level rows use `card card-soft`, standalone panels use `card` with `p-6` (or `p-4`/`p-5` for dense content); consistent `space-y` between stacked cards.
- **Lists**: `divide-y divide-slate-100` between rows; rows are `flex items-center justify-between gap-2/4`, name takes `truncate font-medium`, extra info is `text-xs text-slate-500`.
- **Pagination**: server-side where data can grow (enrolled students, 10/page). Pager style: `← Previous · Page X of Y · Next →` (`btn btn-secondary btn-sm` at either end), plus a "Showing A–B of N" count, rendered only when more than one page.
- **Layout order**: on a subject's manage page, the enrollment-token card comes **above** the enrolled-students card in the right-hand column.
- **Text/typography**: page titles `text-2xl font-semibold tracking-tight`, section headings `text-lg font-semibold`; labels uppercase `text-xs`. Keep the existing slate/indigo palette from `src/app/globals.css`.

## Architecture

- `src/app/` — pages + API routes. Key areas: `admin/` (staff panel), `subjects/` (student dashboard), `exam/[id]/` (start), `attempt/[id]/` (exam runner), `result/[id]/`, auth flow (`login|register|verify`).
- `src/lib/` — `auth.ts`, `db.ts`, `exam.ts` (grading/expiry — scores use per-section `pointsPerQuestion`, falling back to the exam default), `scope.ts` (ownership filters), `snapshots.ts`, `mail.ts`, `format.ts`.
- `src/components/` — grouped `admin/`, `student/`, `auth/`, `dashboard/`.
- Webcam snapshots live on disk under `VERITAS_DATA_DIR`/`snapshots` (default `./data`), never in `public/` or the DB; served only via authenticated admin routes.

## Environment

`.env` (gitignored): `AUTH_SECRET` (required in prod), `VERITAS_DB_FILE`, `VERITAS_DATA_DIR`, optional `RESEND_API_KEY` + `MAIL_FROM` + `VERITAS_BASE_URL` (without Resend, emails are verified instantly / no mail sent). `VERITAS_COOKIE_SECURE=false` disables the production `Secure` cookie for plain-HTTP deployments.

## Scripts & deployment gotchas

- `npm run deploy|update|publish|autorun` route through `scripts/run.js` to OS-specific shell scripts (`deploy.ps1` / `update.ps1` / `publish.ps1` on Windows, `install.sh` / `update.sh` / `publish.sh` on Linux).
- `update.sh`/`update.ps1`/`install.sh`/`deploy.ps1` apply the **latest GitHub release** (`vX.Y.Z` tag from `git fetch origin --tags`, highest by version sort) — never a bare `origin/<branch>` head — so deployments can't run unreleased code. They self-heal a checkout copied to a server without git metadata: `git init` + snapshot commit of the current state, then add origin.
- Docs: `README.md` is the operational source of truth; `prod.md` has the extended production guide. Prefer config/scripts over prose if they conflict.
