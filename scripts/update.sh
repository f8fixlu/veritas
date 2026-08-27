#!/usr/bin/env bash
set -euo pipefail

# Veritas safe update for systemd deployments (Debian/Ubuntu).
# Backs up the database, pulls latest code, rebuilds, verifies the
# better-sqlite3 native binary matches the service Node, restarts and
# health-checks.
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

run_app() {
  local cmd="$1"
  if [ "${#APP_RUN[@]}" -gt 0 ]; then
    "${APP_RUN[@]}" bash -c "export PATH='$NODE_DIR':\$PATH; cd '$APP_DIR' && $cmd"
  else
    bash -c "export PATH='$NODE_DIR':\$PATH; cd '$APP_DIR' && $cmd"
  fi
}

echo "[ok] node      : $NODE_BIN ($("$NODE_BIN" -v 2>/dev/null || echo 'version unknown'))"
echo "[ok] app dir   : $APP_DIR"
echo "[ok] app user  : $SERVICE_USER"

# 3. Database file from .env (falls back to prisma/dev.db).
DB_FILE="$APP_DIR/prisma/dev.db"
if [ -f "$APP_DIR/.env" ]; then
  while IFS='=' read -r k v; do
    [ -z "$k" ] && continue
    case "$k" in \#*) continue ;; esac
    v="${v%\"}"
    v="${v#\"}"
    [ "$k" = "VERITAS_DB_FILE" ] && [ -n "$v" ] && DB_FILE="$v"
  done < <(tr -d '\r' < "$APP_DIR/.env")
fi

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

# 5. Pull latest code (best-effort; a manual checkout is fine too).
if git -C "$APP_DIR" remote >/dev/null 2>&1; then
  BRANCH="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  echo "[..] pulling latest code (origin/$BRANCH)"
  if run_app "git pull --ff-only origin $BRANCH"; then
    echo "[ok] updated $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null)"
  else
    echo "warning: git pull failed — continuing from the current checkout." >&2
  fi
else
  echo "warning: no git remote configured — skipping pull (current checkout used)." >&2
fi

# 6. Reinstall, migrate, seed, build (all under the service's node).
echo "[..] reinstalling dependencies"
run_app "npm ci"
echo "[..] applying database schema"
run_app "npx prisma db push"
echo "[..] seeding admin account (idempotent)"
run_app "npm run seed"
echo "[..] building production bundle"
run_app "npm run build"

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