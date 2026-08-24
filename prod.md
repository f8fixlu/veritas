# Veritas — Production Guide

How to run Veritas in production and publish the source code to GitHub.

---

## Requirements

- **Node.js 20.9 or newer** (LTS recommended) and npm 10+
- A server/VPS (Ubuntu, Windows Server, etc.) — SQLite needs no database service
- For compiling native modules on rare platforms: C/C++ build tools (prebuilt binaries cover most Linux/Windows/macOS setups)

## 1. Get the code & install

```bash
git clone https://github.com/<you>/<repo>.git veritas
cd veritas
npm ci
```

`npm ci` automatically regenerates the Prisma client (`postinstall` hook), so no
manual generate step is needed.

## 2. Configure environment

Create a `.env` file in the project root (never commit it):

```bash
# REQUIRED — signs session cookies. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=<64-char random string>

# OPTIONAL — custom database location (defaults to ./prisma/dev.db)
VERITAS_DB_FILE=/var/data/veritas.db
```

## 3. Create the database

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

## 4. Build & run

```bash
npm run build
npm start            # serves on port 3000
npm start -- -p 8080 # custom port
```

### Keep it running

**Linux (PM2):**

```bash
npm i -g pm2
pm2 start npm --name veritas -- start
pm2 save && pm2 startup
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

## 5. Data & backups

All data lives in **one SQLite file**: `prisma/dev.db` (or `VERITAS_DB_FILE`).

- Backup = copy that file (ideally while the app is stopped, or via
  `sqlite3 <file> ".backup backup.db"`).
- To relocate storage, set `VERITAS_DB_FILE` before starting, then run
  `npx prisma db push` once against the new path.

## 6. Updating an existing deployment

```bash
git pull
npm ci               # reinstall deps + regenerate Prisma client
npx prisma db push   # apply any schema changes
npm run build
pm2 restart veritas  # or your process manager's restart
```

## 7. Publish to GitHub

The repo is already initialized and `.gitignore` excludes everything sensitive
(`node_modules`, `.next`, `.env*`, the SQLite database, generated Prisma client).

```bash
git add -A
git commit -m "Veritas online exam system"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Security checklist before going live

- [ ] `AUTH_SECRET` set to a long random value (sessions are signed with it)
- [ ] Default admin password changed from `admin123`
- [ ] HTTPS enabled in front of the app
- [ ] Regular backups of the SQLite database file
- [ ] Students register themselves; enroll them into subjects via
      **Admin → Subjects → Manage**
