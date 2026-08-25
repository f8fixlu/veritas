# Veritas — Production Guide

How to run Veritas in production and publish the source code to GitHub.

---

## Requirements

- **Node.js 20.9 or newer** (LTS recommended) and npm 10+
- A server/VPS (Ubuntu, Windows Server, etc.) — SQLite needs no database service
- For compiling native modules on rare platforms: C/C++ build tools (prebuilt binaries cover most Linux/Windows/macOS setups)

### Recommended server layout

Don't run the app as root or from `/root`. Create a dedicated user and keep
data outside the app folder so redeploys never touch it:

```bash
adduser --disabled-password veritas
mkdir -p /opt/veritas /var/lib/veritas
chown veritas:veritas /opt/veritas /var/lib/veritas
```

Then as the `veritas` user, clone into `/opt/veritas` and put this in `.env`:

```bash
AUTH_SECRET=<64-char random string>
VERITAS_DB_FILE=/var/lib/veritas/veritas.db
```

The deploy script creates the database directory automatically and both
`prisma db push`, seeding, and the app itself follow `VERITAS_DB_FILE`.
Root is only needed for setup steps (installing packages, chown); the app
itself listens on port 3000 while nginx/Caddy handles 80/443.

## 1. Quick deploy (one command)

```bash
git clone https://github.com/<you>/<repo>.git veritas
cd veritas
npm ci
npm run deploy
```

`npm run deploy` checks Node version, loads/creates `.env`, installs
dependencies if missing, applies the Prisma schema, seeds the admin account,
builds, and starts the server on port 3000.

Flags (note the extra `--` so npm passes them through):

```bash
npm run deploy -- -Port 8080   # serve on a custom port
npm run deploy -- -InitEnv     # first run: create .env with a generated AUTH_SECRET
npm run deploy -- -Fresh       # force dependency reinstall (npm ci)
npm run deploy -- -NoStart     # build only, don't start the server
```

It runs `scripts/deploy.sh` on Linux/macOS and `scripts/deploy.ps1` on Windows
(a small cross-platform launcher picks the right one), so the manual steps
below are what it does under the hood — use them when you need finer control.

## 2. Get the code & install (manual)

```bash
git clone https://github.com/<you>/<repo>.git veritas
cd veritas
npm ci
```

`npm ci` automatically regenerates the Prisma client (`postinstall` hook), so no
manual generate step is needed.

## 3. Configure environment

Create a `.env` file in the project root (never commit it):

```bash
# REQUIRED — signs session cookies. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=<64-char random string>

# OPTIONAL — custom database location (defaults to ./prisma/dev.db)
VERITAS_DB_FILE=/var/data/veritas.db
```

Or let the deploy script do it once:

```bash
npm run deploy -- -InitEnv -NoStart
```

## 4. Create the database

```bash
npx prisma db push   # creates the schema (safe to re-run for updates)
npm run seed         # creates the admin account
```

Default admin credentials:

| Email                 | Password   |
| --------------------- | ---------- |
| `admin@veritas.local` | `admin123` |

> **Change this password immediately** after first login:
> click your name → *Change password*.

## 5. Build & run

```bash
npm run build
npm start            # serves on port 3000
npm start -- -p 8080 # custom port
```

(`npm run deploy` does all of this for you.)

### Keep it running

**Linux (PM2, as the `veritas` user — not root):**

```bash
npm i -g pm2
pm2 start npm --name veritas -- start
pm2 save
pm2 startup systemd -u veritas --hp /opt/veritas   # run the printed command with sudo
```

**Windows:** run inside a NSSM service or a scheduled task that restarts on failure.

### Reverse proxy + HTTPS (recommended)

Point nginx (or Caddy) at `http://localhost:3000`:

```nginx
server {
    listen 443 ssl;
    server_name exams.yourschool.com;
    # ssl_certificate ...;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Caddy does this in two lines with automatic HTTPS:

```
exams.yourschool.com {
    reverse_proxy localhost:3000
}
```

## 6. Data & backups

All data lives in **one SQLite file**: `prisma/dev.db` (or `VERITAS_DB_FILE`).

- Backup = copy that file (ideally while the app is stopped, or via
  `sqlite3 <file> ".backup backup.db"`).
- To relocate storage, set `VERITAS_DB_FILE` in `.env` (the deploy script
  creates the folder), then run `npm run deploy -- -NoStart` or
  `npx prisma db push` once against the new path.

## 7. Updating an existing deployment

```bash
git pull
npm run deploy -- -Fresh -NoStart
pm2 restart veritas    # or your process manager's restart
```

Manual equivalent:

```bash
git pull
npm ci               # reinstall deps + regenerate Prisma client
npx prisma db push   # apply any schema changes
npm run build
pm2 restart veritas  # or your process manager's restart
```

## 8. Publish to GitHub

The repo is already initialized and `.gitignore` excludes everything sensitive
(`node_modules`, `.next`, `.env*`, the SQLite database, generated Prisma client).

**One command does everything** (commit, point origin at
`github.com/f8fixlu/veritas`, rename branch to `main`, push):

```bash
npm run publish            # prompts for a commit message when there are changes
npm run publish -- -Message "Fix grading bug" -DryRun   # preview first

# Linux/macOS direct equivalent:
bash scripts/publish.sh -m "Fix grading bug"
```

Manual equivalent:

```bash
git add -A
git commit -m "Veritas online exam system"
git branch -M main
git remote add origin https://github.com/f8fixlu/veritas.git
git push -u origin main
```

## Security checklist before going live

- [ ] `AUTH_SECRET` set to a long random value (sessions are signed with it)
- [ ] Default admin password changed from `admin123`
- [ ] HTTPS enabled in front of the app
- [ ] Regular backups of the SQLite database file
- [ ] Students register themselves; enroll them into subjects via
      **Admin → Subjects → Manage**
