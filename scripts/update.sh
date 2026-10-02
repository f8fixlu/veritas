#!/usr/bin/env bash
set -euo pipefail

# Veritas safe update for systemd deployments (Debian/Ubuntu).
# Always checks GitHub for the latest released version (vX.Y.Z tag) and applies
# it, backing up the database, stashing local edits (never silently keeping an
# old checkout), rebuilding, verifying the better-sqlite3 native binary matches
# the service Node, restarting and health-checking.
#
# Usage (as root, from the project directory):
#   sudo bash scripts/update.sh
#   sudo bash scripts/update.sh -Port 8080          # custom service port
#   sudo bash scripts/update.sh -NoStart            # prepare but don't restart
#   sudo bash scripts/update.sh -BackupDir /srv/backups
#   (also accepts --port / --no-start / --backup-dir)

PORT="3000"
NO_START=0
BACKUP_DIR="/var/backups"
SERVICE_NAME="veritas"

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    port)
      PORT="$2"
      shift 2
      ;;
    nostart)
      NO_START=1
      shift
      ;;
    backupdir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: sudo bash scripts/update.sh [-Port N] [-NoStart] [-BackupDir DIR]"
      exit 1
      ;;
  esac
done

echo "== Veritas update =="

fail() { echo "error: $*" >&2; exit 1; }

APP_VERSION="$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '?')"
echo "  version    : v$APP_VERSION"

# Packages the build, seed and systemd service rely on. We verify every one
# of these after npm ci so a broken/partial install fails with a clear
# message instead of a bare 'next: command not found' midway through.
# (better-sqlite3 is deliberately not path-checked here — v13 ships prebuilt
# .node files under prebuilds/ and its loadability is proven later by the ABI
# gate via require('better-sqlite3').)
verify_deps() {
  local missing=0
  for p in \
    "node_modules/next/dist/bin/next" \
    "node_modules/.bin/prisma" \
    "node_modules/.bin/tsx"
  do
    if [ ! -e "$APP_DIR/$p" ]; then
      echo "missing after npm ci: $APP_DIR/$p"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ]
}

# 0. Pre-flight — fail fast on a misconfigured environment.
if ! command -v npm >/dev/null 2>&1; then
  fail "npm not found in PATH — install Node.js (nodejs.org or 'apt install nodejs npm')."
fi
[ -f "$APP_DIR/package.json" ] || fail "package.json missing in $APP_DIR — run this from the app directory."
[ -f "$APP_DIR/package-lock.json" ] || fail "package-lock.json missing in $APP_DIR — run 'npm install' once to generate it (then commit it)."
if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "note: node_modules not present yet — npm ci will create it."
fi

# 1. Resolve the node the service runs (build and runtime must share it).
NODE_BIN=""
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ] && command -v systemctl >/dev/null 2>&1; then
  NODE_BIN="$(systemctl show "$SERVICE_NAME" -p ExecStart --value 2>/dev/null | tr -d '"' | awk '{print $1}' || true)"
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node || true)"
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "error: could not resolve the node binary used by the service." >&2
  exit 1
fi
NODE_DIR="$(dirname "$(readlink -f "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")")"

# 2. Whom should the app commands run as? Prefer the service user.
SERVICE_USER="root"
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ] && command -v systemctl >/dev/null 2>&1; then
  UNIT_USER="$(systemctl show "$SERVICE_NAME" -p User --value 2>/dev/null || true)"
  [ -n "$UNIT_USER" ] && SERVICE_USER="$UNIT_USER"
fi
APP_RUN=()
if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1 && [ "$SERVICE_USER" != "root" ]; then
  APP_RUN=(runuser -u "$SERVICE_USER" --)
fi
NPM_CACHE="/var/cache/veritas-npm"
if [ "$(id -u)" -eq 0 ]; then
  install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$NPM_CACHE"
else
  mkdir -p "$NPM_CACHE"
fi
APP_HOME="$(getent passwd "$SERVICE_USER" 2>/dev/null | cut -d: -f6)"
[ -z "$APP_HOME" ] && APP_HOME="/root"

run_app() {
  local cmd="$1"
  if [ "${#APP_RUN[@]}" -gt 0 ]; then
    "${APP_RUN[@]}" bash -c "export HOME='$APP_HOME' npm_config_cache='$NPM_CACHE' PATH='$NODE_DIR':\$PATH; cd '$APP_DIR' && $cmd"
  else
    bash -c "export HOME='$APP_HOME' npm_config_cache='$NPM_CACHE' PATH='$NODE_DIR':\$PATH; cd '$APP_DIR' && $cmd"
  fi
}

# Restore app ownership to the service user so everything the update runs
# (via run_app) can write the app tree. Must run BEFORE the git sync too: git
# fetch/checkout run as the service user, so a .git left root-owned (e.g. by
# an earlier manual 'git init/checkout' under sudo) fails with 'insufficient
# permission' on .git/objects and then silently keeps a stale checkout. The
# src/generated chown matters because that Prisma client output is
# untracked/gitignored, so a git pull never fixes root-owned leftovers and the
# postinstall 'prisma generate' fails with EACCES. Best-effort, idempotent.
fix_app_ownership() {
  if [ "$(id -u)" -eq 0 ]; then
    echo "[..] fixing app ownership for $SERVICE_USER"
    chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR" 2>/dev/null || true
    for d in "node_modules" ".next" "src" "prisma" "data"; do
      [ -e "$APP_DIR/$d" ] && chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/$d" 2>/dev/null || true
    done
    [ -d "$APP_DIR/.git" ] && chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.git" 2>/dev/null || true
    for f in "package.json" "package-lock.json" ".env"; do
      [ -f "$APP_DIR/$f" ] && chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/$f" 2>/dev/null || true
    done
  fi
}

echo "[ok] node      : $NODE_BIN ($("$NODE_BIN" -v 2>/dev/null || echo 'version unknown'))"
echo "[ok] app dir   : $APP_DIR"
echo "[ok] app user  : $SERVICE_USER"
echo "[ok] npm cache : $NPM_CACHE"

# 3. Database file from .env (falls back to prisma/dev.db).
DB_FILE="$APP_DIR/prisma/dev.db"
DATA_DIR="$APP_DIR/data"
if [ -f "$APP_DIR/.env" ]; then
  while IFS='=' read -r k v; do
    [ -z "$k" ] && continue
    case "$k" in \#*) continue ;; esac
    v="${v%\"}"
    v="${v#\"}"
    [ "$k" = "VERITAS_DB_FILE" ] && [ -n "$v" ] && DB_FILE="$v"
    [ "$k" = "VERITAS_DATA_DIR" ] && [ -n "$v" ] && DATA_DIR="$v"
  done < <(tr -d '\r' < "$APP_DIR/.env")
fi

# The snapshot data root must exist and be writable by the service user
# whether it lives inside the app dir or somewhere shared like ../data.
# Best-effort: the app also creates it lazily on first upload, so a blocked
# pre-create must not abort the update before the database backup happens.
mkdir -p "$DATA_DIR/snapshots" 2>/dev/null || \
  echo "warning: could not create $DATA_DIR/snapshots — the app will try on first upload." >&2
if [ "$(id -u)" -eq 0 ]; then
  chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR" 2>/dev/null || true
fi
echo "[ok] data dir  : $DATA_DIR"

# 4. Backup the database before touching anything.
SHA_BEFORE="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
STAMP="$(date +%F-%H%M%S)"
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/${SERVICE_NAME}-${STAMP}.db"
if [ -f "$DB_FILE" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '$BACKUP_PATH'"
  else
    cp "$DB_FILE" "$BACKUP_PATH"
  fi
  echo "[ok] database backed up: $BACKUP_PATH"
else
  echo "warning: database file not found at $DB_FILE — skipping backup." >&2
  BACKUP_PATH=""
fi

# The git sync below runs as the service user; fix ownership first so a
# root-owned .git can never abort the fetch (and silently skip the update).
fix_app_ownership

# 5. Sync to the latest GitHub release. The server must always run the newest
#    published release tag (vX.Y.Z), never an unreleased commit from the head
#    of origin/$BRANCH — a deployment machine cannot drift ahead of what was
#    actually released. Local edits are stashed (never lost) and a diverged
#    local history is kept as a backup branch before the current branch is
#    re-pointed onto the latest release. Only a network failure falls back to
#    the current checkout, and that warning is loud.
REPO="https://github.com/f8fixlu/veritas.git"

# Self-heal a checkout that was copied straight onto the server (no .git and/or
# no remote): initialize a repository and commit the current state as a
# snapshot so the backup-branch/rollback story keeps working, then add the
# origin so the latest release can always be fetched.
if ! git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "[..] no git repository here — initializing one (current state saved as a snapshot commit)"
  if ! run_app "git init -q && git branch -M main && git config user.name 'veritas-deploy' && git config user.email 'deploy@veritas.local' && git add -A && (git diff --cached --quiet 2>/dev/null || git commit -q -m 'veritas pre-update state $(date +%F-%H%M%S)')"; then
    fail "could not initialize a git repository in $APP_DIR"
  fi
fi
if [ -z "$(git -C "$APP_DIR" remote 2>/dev/null)" ]; then
  echo "[..] no git remote configured — adding origin $REPO"
  run_app "git remote add origin '$REPO'" \
    || echo "warning: could not add origin $REPO — using the current checkout." >&2
fi

if git -C "$APP_DIR" remote >/dev/null 2>&1; then
  BRANCH="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  [ "$BRANCH" = "HEAD" ] && BRANCH="main"
  TARGET=""
  FETCHED=0
  if run_app "git fetch origin --tags"; then
    FETCHED=1
  elif [ "$(id -u)" -eq 0 ] && git -C "$APP_DIR" fetch origin --tags; then
    # The service user could not write .git (root-owned checkout the chown
    # could not reach). Retry as root so the refs are guaranteed fresh — a
    # stale origin ref must never be used to claim "already at the latest
    # release" while a newer release exists.
    echo "note: git fetch failed as $SERVICE_USER — retried as root (check .git ownership)." >&2
    FETCHED=1
  else
    echo "warning: could not fetch from origin — the checkout is NOT synced to the latest release; continuing with the current code." >&2
  fi

  if [ "$FETCHED" -eq 1 ]; then
    RELEASE_TAG="$(git -C "$APP_DIR" tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname 2>/dev/null | head -n1)"
    if [ -n "$RELEASE_TAG" ]; then
      TARGET="$RELEASE_TAG"
      echo "[ok] latest released version : $RELEASE_TAG"
    else
      echo "warning: no release tags found — falling back to origin/$BRANCH." >&2
    fi
  fi
  # Only fall back to origin/$BRANCH when the fetch actually succeeded; on a
  # failed fetch the ref is stale and must not drive the checkout decision.
  if [ -z "$TARGET" ] && [ "$FETCHED" -eq 1 ]; then
    if git -C "$APP_DIR" rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
      TARGET="origin/$BRANCH"
    else
      echo "warning: origin/$BRANCH does not exist — continuing from the current checkout." >&2
    fi
  fi

  if [ -n "$TARGET" ]; then
    HEAD_SHA="$(git -C "$APP_DIR" rev-parse HEAD)"
    TARGET_SHA="$(git -C "$APP_DIR" rev-parse "$TARGET")"
    if [ "$HEAD_SHA" = "$TARGET_SHA" ]; then
      echo "[ok] already at the latest release ($(git -C "$APP_DIR" rev-parse --short HEAD))"
    else
      if ! run_app "git merge-base --is-ancestor HEAD $TARGET"; then
        BK="backup/update-$(date +%F-%H%M%S)"
        run_app "git branch -f $BK HEAD" || \
          echo "warning: could not create backup branch $BK — continuing anyway." >&2
        echo "[..] local history diverged — saved as branch '$BK'"
      fi
      STASH_MSG=""
      if [ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]; then
        STASH_MSG="veritas auto-update $(date +%F-%H%M%S)"
        echo "[..] local edits found — stashing as '$STASH_MSG'"
        run_app "git stash push -m '$STASH_MSG'"
      fi
      if ! run_app "git checkout -B $BRANCH $TARGET"; then
        echo "error: could not move the checkout to $TARGET" >&2
        exit 1
      fi
      echo "[ok] applied release $TARGET ($(git -C "$APP_DIR" rev-parse --short HEAD))"
      if [ -n "$STASH_MSG" ]; then
        echo "     local edits kept in stash '$STASH_MSG' (see: git stash list)" >&2
      fi
    fi
  else
    echo "note: staying on the current checkout ($(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown))." >&2
  fi
else
  echo "warning: no git remote configured — skipping pull (current checkout used)." >&2
fi

# 6. Reinstall, migrate, seed, build (all under the service's node).
# If the app directory was ever installed as root (e.g. a manual
# `sudo npm install`), node_modules is root-owned and the service user can't
# unlink/rewrite it — npm ci fails with EACCES. As root, restore ownership to
# the service user before reinstalling.
fix_app_ownership
# Prove the service user really can write the app dir (needed even just to
# create node_modules on a fresh checkout), not merely own the chowned trees.
if ! run_app "touch '.update-probe' && rm '.update-probe'"; then
  fail "the service user '$SERVICE_USER' cannot write $APP_DIR. As root, run: chown -R '$SERVICE_USER:$SERVICE_USER' '$APP_DIR' and re-run the update."
fi

# Remove a stray untracked src/app/dashboard directory if it is NOT part of
# the repository (it is only a leftover/conflict in the working tree and would
# break the build). Safe: tracked files are left untouched.
if [ -e "$APP_DIR/src/app/dashboard" ] && [ -z "$(git -C "$APP_DIR" ls-files -- src/app/dashboard 2>/dev/null)" ]; then
  echo "[..] removing stray untracked src/app/dashboard"
  rm -rf "$APP_DIR/src/app/dashboard"
fi

# npm ci wipes node_modules and re-fetches everything; a corrupt persistent
# npm cache can ship a broken native binary and crash mid-install (e.g.
# SIGILL / Illegal instruction on a package postinstall). On a failed install
# we clear the cache and retry once before declaring failure.
npm_ci() {
  if run_app "npm ci"; then
    return 0
  fi
  echo "      npm ci failed — clearing the npm cache ($NPM_CACHE) and retrying once." >&2
  run_app "npm cache clean --force" || \
    echo "warning: could not clean the npm cache ($NPM_CACHE)." >&2
  run_app "npm ci"
}

echo "[..] reinstalling dependencies"
npm_ci
if [ ! -e "$APP_DIR/node_modules/next/dist/bin/next" ]; then
  echo "warning: 'next' was not installed by npm ci — retrying once"
  run_app "npm ci"
fi
if ! verify_deps; then
  echo "dependencies are incomplete after npm ci." >&2
  echo "Run manually to see the real error:" >&2
  echo "  cd '$APP_DIR' && sudo -u '$SERVICE_USER' npm ci" >&2
  echo "Then check disk space (df -h) and the npm output above." >&2
  fail "npm ci failed to install one or more required packages."
fi
echo "[..] applying database schema"
run_app "npx prisma db push"
echo "[..] seeding admin account (idempotent)"
run_app "npm run seed"
echo "[..] building production bundle"
run_app "npm run build"
[ -f "$APP_DIR/.next/BUILD_ID" ] && [ -d "$APP_DIR/.next/server" ] \
  || fail "production build is incomplete (.next/BUILD_ID missing). Inspect the 'npm run build' output above for the real error."
if [ "$(id -u)" -eq 0 ] && [ -d "$APP_DIR/.next" ]; then
  chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.next" 2>/dev/null || true
fi

# 7. ABI gate — prove the native module loads under the service's node.
echo "[..] verifying better-sqlite3 against '$NODE_BIN' ($("$NODE_BIN" -e "console.log('ABI', process.versions.modules)" 2>/dev/null || echo '?'))"
GATE_OK=1
if ! run_app "'$NODE_BIN' -e \"require('better-sqlite3'); console.log('OK')\""; then
  GATE_OK=0
fi
NESTED="$APP_DIR/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3"
if [ "$GATE_OK" -eq 1 ] && [ -f "$NESTED/build/Release/better_sqlite3.node" ]; then
  if ! run_app "'$NODE_BIN' -e \"require('$NESTED'); console.log('OK')\""; then
    GATE_OK=0
  fi
fi
if [ "$GATE_OK" -eq 0 ]; then
  echo "error: better-sqlite3 does not load under the service's node." >&2
  echo "       The native binary and the runtime Node must share an ABI." >&2
  echo "       Do NOT restart the service; the old build is still live." >&2
  exit 1
fi
echo "[ok] better-sqlite3 loads cleanly"

# 8. Restart + health check.
echo ""
if [ "$NO_START" -eq 1 ]; then
  echo "== Update ready (NoStart) =="
  echo "Restart with : sudo systemctl restart $SERVICE_NAME"
else
  echo "[..] restarting service"
  systemctl restart "$SERVICE_NAME"
  sleep 1
  CODE="$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/login" 2>/dev/null || echo 000)"
  if [ "$CODE" = "200" ] || [ "$CODE" = "302" ]; then
    echo "[ok] server responds on port $PORT (HTTP $CODE)"
  else
    echo "note: server did not answer yet — check journalctl -u $SERVICE_NAME" >&2
  fi
fi

SHA_AFTER="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo ""
echo "== Update finished =="
echo "  deployed SHA : $SHA_AFTER"
echo "  previous SHA : $SHA_BEFORE"
[ -n "$BACKUP_PATH" ] && echo "  db backup    : $BACKUP_PATH"
echo "  logs         : journalctl -u $SERVICE_NAME -f"
echo "  rollback     : git checkout $SHA_BEFORE && npm ci && npm run build,"
[ -n "$BACKUP_PATH" ] && echo "                 then restore $BACKUP_PATH and restart the service."