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
- DB file: `VERITAS_DB_FILE` env or `prisma/dev.db` (gitignored). Access everything through `getDb()` in `src/lib/db.ts` (global singleton + better-sqlite3 adapter).
- SQLite: no concurrent writers; keep the DB on local disk; back up with sqlite3 `.backup`.
- Roles are **plain strings** (`ADMIN | INSTRUCTOR | STUDENT`) on `User.role` — not Prisma enums (SQLite limitation). Staff = ADMIN or INSTRUCTOR (`isStaff()`).

## Auth conventions (`src/lib/auth.ts`)

Sessions are a JWT cookie `veritas_session` signed with `AUTH_SECRET` (falls back to a dev secret); each user has a `sessionVersion` bumped on login to revoke older sessions.

- **Pages (server components/actions):** `requireUser()` / `requireStaff()` / `requireAdmin()` — redirect on failure.
- **API routes:** `requireApiUser()` / `requireApiStaff()` / `requireApiAdmin()` — return `null` on failure; respond 401 yourself.
- Admin-only features (e.g. instructor management) use the Admin variants; most `/api/admin/*` routes use Staff.
- Unverified students are blocked from `requireUser`/`requireApiUser` (redirect to `/verify-required` or 401).

## Architecture

- `src/app/` — pages + API routes. Key areas: `admin/` (staff panel), `subjects/` (student dashboard), `exam/[id]/` (start), `attempt/[id]/` (exam runner), `result/[id]/`, auth flow (`login|register|verify`).
- `src/lib/` — `auth.ts`, `db.ts`, `exam.ts` (grading/expiry — scores use per-section `pointsPerQuestion`, falling back to the exam default), `snapshots.ts`, `mail.ts`, `format.ts`.
- `src/components/` — grouped `admin/`, `student/`, `auth/`, `dashboard/`.
- Webcam snapshots live on disk under `VERITAS_DATA_DIR`/`snapshots` (default `./data`), never in `public/` or the DB; served only via authenticated admin routes.

## Environment

`.env` (gitignored): `AUTH_SECRET` (required in prod), `VERITAS_DB_FILE`, `VERITAS_DATA_DIR`, optional `RESEND_API_KEY` + `MAIL_FROM` + `VERITAS_BASE_URL` (without Resend, emails are verified instantly / no mail sent).

## Scripts & deployment gotchas

- `npm run deploy|update|publish|autorun` route through `scripts/run.js` to OS-specific shell scripts (`deploy.ps1` / `update.ps1` / `publish.ps1` on Windows, `install.sh` / `update.sh` / `publish.sh` on Linux).
- Docs: `README.md` is the operational source of truth; `prod.md` has the extended production guide. Prefer config/scripts over prose if they conflict.
