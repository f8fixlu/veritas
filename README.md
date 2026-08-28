# Veritas

A self-hosted online exam system built with Next.js (App Router) and SQLite —
subjects with student enrollment, timed multiple-choice exams with named
sections, randomized question order, Excel/CSV import, automatic grading,
per-exam reports and leaderboards, email verification (Resend), and
anti-cheating measures. No external services are required to run: sessions are
signed with `AUTH_SECRET`, passwords hashed with bcrypt, and the whole database
is one SQLite file.

---

## Requirements

- **Node.js 22 LTS** (see `.nvmrc`) — use a **single, system-wide install**.
  The native `better-sqlite3` binary is compiled against a specific Node ABI;
  the Node that **builds** must be the Node that **runs** (details in
  [Troubleshooting](#troubleshooting)).
- **npm 10+**.
- A Linux server (Debian/Ubuntu recommended for the systemd helper) or any
  platform that runs Node and can compile/carry `better-sqlite3`.

---

## Quick start (development)

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server includes
the admin setup on first seed:

```bash
npm run seed   # creates the default admin account
```

> **Change the default admin password immediately.** Default credentials are
> `admin@veritas.local` / `admin123` (see [Security](#security-checklist)).

---

## Production deployment

### Recommended server layout

Run the app as a dedicated user and keep data **outside** the app folder so
redeploys never touch it:

```bash
adduser --disabled-password veritas
mkdir -p /opt/veritas /var/lib/veritas
chown veritas:veritas /opt/veritas /var/lib/veritas
```

### Environment variables

Create a `.env` file in the project root (never commit it):

| Variable | Required | Default | Description |
| -------- | :------: | ------- | ----------- |
| `AUTH_SECRET` | yes | — | Signs session cookies. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `VERITAS_DB_FILE` | no | `./prisma/dev.db` | SQLite database path (keep it outside the app dir) |
| `RESEND_API_KEY` | no | — | Enables email verification links (via Resend) |
| `MAIL_FROM` | no | — | Verified sender address, e.g. `"Veritas <onboarding@resend.dev>"` |
| `VERITAS_BASE_URL` | no | — | Public base URL used in emailed links |

Without `RESEND_API_KEY`, new accounts are verified instantly so the app stays
usable offline.

### One-command deploy

```bash
npm ci
npm run deploy
```

`deploy.sh` checks the Node version (≥ 20.9; Node 22 recommended), loads or
creates `.env`, installs dependencies, applies the Prisma schema
(`prisma db push`), seeds the admin account, builds, and starts on port 3000.

Flags (the `--` is required for npm to forward them):

```bash
npm run deploy -- -Port 8080    # serve on a custom port
npm run deploy -- -InitEnv      # first run: generate .env with a random AUTH_SECRET
npm run deploy -- -Fresh        # force dependency reinstall (npm ci)
npm run deploy -- -NoStart      # prepare everything, don't start yet
```

### Keep it running (systemd — Debian/Ubuntu)

```bash
sudo npm run autorun                         # install & start on port 3000
sudo npm run autorun -- -Port 8080 -User veritas
sudo npm run autorun -- -Uninstall           # remove the service

systemctl status veritas                     # is it running?
journalctl -u veritas -f                     # follow the logs
```

The service starts on boot and restarts 5 seconds after any crash.

> **Node rule:** the node the service runs (`systemctl cat veritas` →
> `ExecStart`) must be the node that runs `npm ci`/`next build`. Keep exactly
> one Node install on the box — do **not** add nvm back; systemd can't source
> your shell profile and this mismatch is the #1 cause of downtime here.

### Reverse proxy + HTTPS

Point nginx (or Caddy) at `http://localhost:3000`:

```nginx
server {
    listen 443 ssl;
    server_name exams.yourschool.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Caddy does the same in two lines with automatic HTTPS:

```
exams.yourschool.com {
    reverse_proxy localhost:3000
}
```

---

## Updating

```bash
sudo npm run update
```

`scripts/update.sh` (needs `sudo`): backs up the database, pulls the latest
code (`origin/<branch>` — no manual upstream tracking required), reinstalls
dependencies, applies the Prisma schema, re-seeds the admin account
(idempotent), rebuilds, **verifies `better-sqlite3` loads under the service's
Node** (the ABI gate), then restarts and health-checks the service. If any step
fails it stops **before** restarting — a bad update never takes down a working
server.

Flags:

```bash
sudo npm run update -- -Port 8080                # service on a custom port
sudo npm run update -- -NoStart                  # prepare, don't restart
sudo npm run update -- -BackupDir /srv/backups   # custom backup location
```

`update.sh` prints the deployed git SHA, the previous SHA, and the database
backup path — everything you need for a rollback (below).

---

## Backup & restore

All data lives in **one SQLite file** (`VERITAS_DB_FILE`, default
`prisma/dev.db`).

```bash
# backup (safe while the app is running)
sqlite3 /var/lib/veritas/veritas.db ".backup /var/backups/veritas-$(date +%F).db"

# restore
systemctl stop veritas
cp /var/backups/veritas-<date>.db /var/lib/veritas/veritas.db
systemctl start veritas
```

## Rollback

```bash
cd /opt/veritas
git checkout <previous-SHA>          # printed by update.sh
npm ci && npm run build
sudo systemctl restart veritas
```

If data changed, restore the matching database backup from before the update.

---

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `Module did not self-register` / `ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION X requires Y` | `better-sqlite3` binary was built with a different Node version than the one running it (ABI mismatch) | Use **one** Node install; rebuild with the service's node: `rm -rf node_modules && npm ci`, verify with `node -e "require('better-sqlite3'); console.log('OK')"`, then `sudo systemctl restart veritas` |
| `status=203/EXEC` / `Failed to execute ...: Permission denied` | systemd `ExecStart` points at a path the service user can't reach (e.g. `/root/.nvm/...`) | Point the unit at the system-wide node (`/usr/bin/node`) and re-run `sudo bash scripts/autorun.sh -User veritas` |
| `npm ci` fails: `Missing: <pkg> from lock file` | `package-lock.json` is out of sync with `package.json` (or was generated on another platform) | Run `npm install` to sync the lockfile and commit it, then `npm ci` again |
| `There is no tracking information for the current branch` | Fresh clone/branch has no upstream | `update.sh` now pulls `origin/<branch>` explicitly and needs nothing; optionally run `git branch --set-upstream-to=origin/main main` once |
| `Invalid username or token` when pulling | Repo is private or doesn't exist | Make the repo public, or configure credentials/SSH on the server |
| Prisma "database is locked" | Concurrent writes to the SQLite file | Keep `VERITAS_DB_FILE` on local disk (not a network share) and back up with `.backup` |

The one command that catches most of this before it hurts you:

```bash
node -e "require('better-sqlite3'); console.log('OK')"
```

Run it after every dependency reinstall or Node change, **before** restarting
the service.

---

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Build the production bundle |
| `npm start -- -p PORT` | Serve the production build |
| `npm run seed` | Seed the admin account (idempotent) |
| `npm run reset-admin` | Force-reset the admin password |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Full production deployment |
| `npm run update` | Safe production update (backup, rebuild, restart) |
| `npm run autorun` | Install/remove the systemd service (Debian/Ubuntu, `sudo`) |
| `npm run publish` | Commit & push the source to GitHub |

---

## Security checklist

- [ ] `AUTH_SECRET` set to a long random value (sessions are signed with it)
- [ ] Default admin password changed from `admin123`
- [ ] HTTPS enabled in front of the app
- [ ] Regular backups of the SQLite database file
- [ ] `.env`, `prisma/dev.db`, and `node_modules/` excluded from git (already in `.gitignore`)
- [ ] App runs as a non-root user (`veritas`), never `root`

---

## Project structure

```
veritas/
├── prisma/schema.prisma       # Data model: User, Subject, Enrollment, Exam,
│                              # ExamSection, Question, Attempt, Answer
├── scripts/
│   ├── seed.ts                # Admin account seeding (npm run seed)
│   ├── deploy.sh / .ps1       # Production deployment
│   ├── update.sh              # Safe production update (npm run update)
│   ├── autorun.sh             # systemd auto-start helper
│   └── publish.sh / .ps1      # GitHub publishing
├── public/                    # Static assets
└── src/
    ├── app/                   # Next.js App Router: pages + API routes
    │   ├── admin/             # Admin panel (subjects, exams, students, reports)
    │   ├── subjects/          # Student dashboard (paginated exam list)
    │   ├── exam/[id]/         # Exam start page
    │   ├── attempt/[id]/      # Exam runner (5 questions per page)
    │   ├── result/[id]/       # Results + question review
    │   └── login|register|verify/   # Auth flow
    ├── components/            # Admin, dashboard, and exam-runner components
    ├── lib/                   # auth, database, exam logic, formatting
    └── generated/prisma/      # Generated Prisma client (regenerated on npm ci)
```

---

See [prod.md](./prod.md) for the extended production guide (manual install
steps, PM2 alternative, and GitHub publishing walkthrough).

---

## License

MIT — see the [LICENSE](./LICENSE) file for details.