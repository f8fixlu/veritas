#!/usr/bin/env bash
set -euo pipefail

# Veritas installer — fresh production install on Debian/Ubuntu (also macOS).
#
# Two ways to run it:
#
#   1. One-command (fetches this script and installs from the latest release):
#        curl -sSL https://raw.githubusercontent.com/f8fixlu/veritas/main/scripts/install.sh | sudo bash
#      (flags pass through after the -- separator:)
#        curl -sSL .../install.sh | sudo bash -s -- -Dir /srv/veritas -Port 8080
#
#   2. Manual (clone first, then install from the checkout):
#        git clone https://github.com/f8fixlu/veritas.git
#        cd veritas
#        sudo bash scripts/install.sh
#
# Flags (also accepted in --dash form):
#   -Dir PATH     install folder            (default: /opt/veritas; ignored in manual mode)
#   -Repo URL     repository to clone       (default: https://github.com/f8fixlu/veritas.git)
#   -User NAME    system user for the app   (default: veritas, or $SUDO_USER)
#   -Port N       port the app listens on   (default: 3000)
#   -Fresh        force dependency reinstall (npm ci) even if node_modules exists
#   -NoStart      install + build but do NOT create the systemd service
#   -Yes          no prompts — auto-install missing packages, pick defaults
#
# What it does: installs missing prerequisites (git/nodejs/npm), clones the
# repo, creates the system user + .env (external data layout under
# /var/lib/veritas), runs npm ci / prisma db push / seed / build as that user,
# then installs the veritas.service and starts it (unless -NoStart).

PORT="3000"
OPT_DIR=""
REPO="https://github.com/f8fixlu/veritas.git"
OPT_USER=""
FRESH=0
NO_START=0
YES=0

# Where the app lives. In manual mode this is overridden by the checkout we
# are already inside of.
APP_DIR="${OPT_DIR:-/opt/veritas}"

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    port)
      PORT="$2"
      shift 2
      ;;
    dir)
      OPT_DIR="$2"
      APP_DIR="$OPT_DIR"
      shift 2
      ;;
    repo)
      REPO="$2"
      shift 2
      ;;
    user)
      OPT_USER="$2"
      shift 2
      ;;
    fresh)
      FRESH=1
      shift
      ;;
    nostart)
      NO_START=1
      shift
      ;;
    yes)
      YES=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/install.sh [-Dir PATH] [-Repo URL] [-User NAME] [-Port N] [-Fresh] [-NoStart] [-Yes]"
      exit 1
      ;;
  esac
done

fail() { echo "error: $*" >&2; exit 1; }

# Manual (clone-first) mode: run from a checkout, don't clone again.
IN_PLACE=0
if [ -z "$OPT_DIR" ] && [ -f "package.json" ] && [ -d "prisma" ]; then
  IN_PLACE=1
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

echo "== Veritas installer =="

IS_ROOT="$( [ "$(id -u)" -eq 0 ] && echo 1 || echo 0 )"
HAVE_SUDO="$( command -v sudo >/dev/null 2>&1 && echo 1 || echo 0 )"

# ---------------------------------------------------------------------------
# Confirmation prompt. Reads from the controlling terminal so it still works
# when the script arrives via `curl ... | bash`; with no tty available it
# proceeds (matching how `| bash` installs behave).
ask_yes_no() {
  local ans=""
  if [ "$YES" -eq 1 ]; then return 0; fi
  if [ -e /dev/tty ] && [ -r /dev/tty ] && [ -w /dev/tty ]; then
    read -r -p "$1 [Y/n] " ans < /dev/tty || ans=""
  else
    echo "($1 — no terminal here, proceeding)"
    return 0
  fi
  case "$ans" in
    ""|y|Y|yes|YES|Yes) return 0 ;;
    *) return 1 ;;
  esac
}

# Run a privileged command (root directly, otherwise via sudo).
run_priv() {
  if [ "$IS_ROOT" -eq 1 ]; then
    bash -c "$1"
  else
    sudo bash -c "$1"
  fi
}

# ---------------------------------------------------------------------------
# 1. Prerequisites: git, curl, node 20.9+, npm.
command -v apt-get >/dev/null 2>&1 && { HAS_APT=1; } || { HAS_APT=0; }

missing=""
for c in git curl node npm; do
  command -v "$c" >/dev/null 2>&1 || { [ -z "$missing" ] && missing="$c" || missing="$missing $c"; }
done

if [ -n "$missing" ]; then
  echo "[..] missing prerequisites:$missing"
  if [ "$HAS_APT" -eq 0 ]; then
    fail "no apt detected — install git, curl, Node.js >= 20.9 and npm for your OS, then re-run."
  fi
  if [ "$IS_ROOT" -eq 0 ] && [ "$HAVE_SUDO" -eq 0 ]; then
    fail "run this installer with sudo (needs apt to install nodejs, git, curl)."
  fi
  if ask_yes_no "Install$missing via apt? (apt-get install ...)"; then
    echo "[..] apt-get update + install"
    run_priv "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y git curl nodejs npm" \
      || fail "apt install failed — install git, nodejs and npm manually, then re-run."
  else
    fail "prerequisites required — install git, nodejs and npm, then re-run."
  fi
fi

NODE_VER="$(node -v)"
MINOR_OK="$(printf '%s\n' "v20.9.0" "$NODE_VER" | sort -V | head -n1)"
if [ "$MINOR_OK" != "v20.9.0" ]; then
  echo "current Node is too old for Veritas: $NODE_VER (>= 20.9 required, 22 LTS recommended)"
  if [ "$HAS_APT" -eq 1 ] && ask_yes_no "Install Node.js 22 LTS via NodeSource?"; then
    run_priv "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -" \
      || fail "NodeSource setup failed."
    run_priv "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs" \
      || fail "nodejs install failed."
  else
    fail "install Node.js >= 20.9 (recent distros ship 22 LTS) and re-run."
  fi
fi
echo "[ok] node      : $(node -v)"

# ---------------------------------------------------------------------------
# 2. Who runs the app.
if [ -n "$OPT_USER" ]; then
  APP_USER="$OPT_USER"
elif id veritas >/dev/null 2>&1; then
  APP_USER="veritas"
elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  APP_USER="$SUDO_USER"
elif [ "$IS_ROOT" -eq 1 ]; then
  APP_USER="veritas"
else
  APP_USER="$(id -un)"
fi

if [ "$IS_ROOT" -eq 1 ] && [ "$APP_USER" != "root" ] && ! id "$APP_USER" >/dev/null 2>&1; then
  echo "[..] creating system user '$APP_USER'"
  run_priv "useradd -m -s /bin/bash '$APP_USER'" || fail "could not create user '$APP_USER'."
fi
if id "$APP_USER" >/dev/null 2>&1; then
  APP_HOME="$(getent passwd "$APP_USER" 2>/dev/null | cut -d: -f6)" || true
  APP_HOME="${APP_HOME:-$HOME}"
  APP_NPM_CACHE="$APP_HOME/.npm"
else
  APP_HOME="$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f6)" || true
  APP_HOME="${APP_HOME:-$HOME}"
  APP_USER="$(id -un)"
  APP_NPM_CACHE="$APP_HOME/.npm"
  echo "note: user cannot be created without root — installing as '$APP_USER'." >&2
fi
echo "[ok] app user  : $APP_USER"

# Run a command in the app folder as the app user (root setups use sudo -u;
# this also re-sources .env so prisma/next see VERITAS_DB_FILE even through
# sudo's environment reset).
app_run() {
  local cmd="$1"
  if [ "$IS_ROOT" -eq 1 ] && [ "$APP_USER" != "root" ]; then
    sudo -u "$APP_USER" -H bash -c "set -a; . '$APP_DIR/.env' 2>/dev/null || true; set +a; export HOME='$APP_HOME' npm_config_cache='$APP_NPM_CACHE'; cd '$APP_DIR' && $cmd"
  else
    bash -c "set -a; . '$APP_DIR/.env' 2>/dev/null || true; set +a; cd '$APP_DIR' && $cmd"
  fi
}

mkdir -p "$APP_NPM_CACHE" 2>/dev/null || true
if [ "$IS_ROOT" -eq 1 ] && [ "$APP_USER" != "root" ]; then
  chown -R "$APP_USER" "$APP_NPM_CACHE" 2>/dev/null || true
fi

# Create a folder, chowning to the app user when running as root.
need_dir() {
  local d="$1"
  mkdir -p "$d" 2>/dev/null || run_priv "mkdir -p '$d'" || fail "could not create $d"
  if [ "$IS_ROOT" -eq 1 ] && [ "$APP_USER" != "root" ]; then
    chown -R "$APP_USER" "$d" 2>/dev/null || true
  fi
}

# Sync an existing checkout to the latest pushed release: stash local edits
# (kept, never lost), back up diverged history as a branch, then move onto
# origin/<branch>. .env, the SQLite DB and /data are gitignored, so nothing
# that matters is ever touched.
sync_latest() {
  if ! git -C "$APP_DIR" remote >/dev/null 2>&1; then
    echo "warning: no git remote configured — using the checked-out code." >&2
    return 0
  fi
  local branch
  branch="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  if ! git -C "$APP_DIR" rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    echo "warning: origin/$branch does not exist — using the checked-out code." >&2
    return 0
  fi
  echo "[..] fetching origin/$branch"
  if ! app_run "git fetch origin $branch"; then
    echo "warning: could not fetch origin/$branch — using the current checkout." >&2
    return 0
  fi
  local head remote
  head="$(git -C "$APP_DIR" rev-parse HEAD)"
  remote="$(git -C "$APP_DIR" rev-parse "origin/$branch")"
  if [ "$head" = "$remote" ]; then
    echo "[ok] up to date at $(git -C "$APP_DIR" rev-parse --short HEAD)"
    return 0
  fi
  if ! app_run "git merge-base --is-ancestor HEAD origin/$branch"; then
    local backup="backup/install-$(date +%F-%H%M%S)"
    app_run "git branch -f $backup HEAD" \
      || echo "warning: could not create backup branch $backup — continuing anyway." >&2
    echo "[..] local history diverged — saved as branch '$backup'"
  fi
  local stash_msg=""
  if [ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]; then
    stash_msg="veritas auto-install $(date +%F-%H%M%S)"
    echo "[..] local edits found — stashing as '$stash_msg'"
    app_run "git stash push -m '$stash_msg'"
  fi
  if ! app_run "git reset --hard origin/$branch"; then
    fail "could not move the checkout to origin/$branch"
  fi
  echo "[ok] updated to $(git -C "$APP_DIR" rev-parse --short HEAD)"
  if [ -n "$stash_msg" ]; then
    echo "     local edits kept in stash '$stash_msg' (see: git stash list)" >&2
  fi
}

# ---------------------------------------------------------------------------
# 3. Get the code.
if [ "$IN_PLACE" -eq 1 ]; then
  echo "[ok] code      : running from existing checkout at $APP_DIR"
  sync_latest
else
  if [ -e "$APP_DIR/package.json" ]; then
    if git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
      echo "[..] existing checkout at $APP_DIR — syncing to the latest release"
      sync_latest
    else
      fail "$APP_DIR is not a git repository — run 'git clone $REPO $APP_DIR' or pick an empty target (-Dir)."
    fi
  else
    [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ] \
      && fail "target $APP_DIR exists and is not empty — install into an empty folder (-Dir)."
    need_dir "$(dirname "$APP_DIR")"
    need_dir "$APP_DIR"
    echo "[..] cloning $REPO -> $APP_DIR"
    app_run "git clone '$REPO' '.'" || fail "git clone failed — check your network and '$REPO'."
  fi
fi

cd "$APP_DIR"

APP_VERSION="$(node -e "console.log(require('$APP_DIR/package.json').version)" 2>/dev/null || echo '?')"
echo "  version    : v$APP_VERSION"

# ---------------------------------------------------------------------------
# 4. Environment + data layout (external, so redeploys never touch data).
if [ ! -f "$APP_DIR/.env" ]; then
  SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  if [ "$IS_ROOT" -eq 1 ]; then
    {
      echo "AUTH_SECRET=$SECRET"
      echo "VERITAS_DB_FILE=/var/lib/veritas/dev.db"
      echo "VERITAS_DATA_DIR=/var/lib/veritas"
      echo "# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # enables email verification"
      echo "# MAIL_FROM=\"Veritas <onboarding@yourdomain.com>\""
      echo "# VERITAS_BASE_URL=https://exams.yourschool.com"
    } > "$APP_DIR/.env"
    echo "[ok] created .env (AUTH_SECRET generated; data kept outside the app dir)"
  else
    {
      echo "AUTH_SECRET=$SECRET"
      echo "# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # enables email verification"
      echo "# MAIL_FROM=\"Veritas <onboarding@yourdomain.com>\""
      echo "# VERITAS_BASE_URL=https://exams.yourschool.com"
    } > "$APP_DIR/.env"
    echo "[ok] created .env (AUTH_SECRET generated; in-app data layout — no root needed)"
  fi
  if [ "$IS_ROOT" -eq 1 ]; then chown "$APP_USER" "$APP_DIR/.env"; fi
  chmod 600 "$APP_DIR/.env"
else
  echo "[ok] .env found — using existing values"
fi

set -a
while IFS='=' read -r k v; do
  [ -z "$k" ] && continue
  case "$k" in \#*) continue ;; esac
  v="${v%\"}"; v="${v#\"}"
  export "$k=$v"
done < <(tr -d '\r' < "$APP_DIR/.env")
set +a

VERITAS_DB_FILE="${VERITAS_DB_FILE:-$APP_DIR/prisma/dev.db}"
VERITAS_DATA_DIR="${VERITAS_DATA_DIR:-$APP_DIR/data}"
need_dir "$(dirname "$VERITAS_DB_FILE")"
need_dir "$VERITAS_DATA_DIR/snapshots"
echo "[ok] database file: $VERITAS_DB_FILE"
echo "[ok] snapshots dir: $VERITAS_DATA_DIR/snapshots"

# ---------------------------------------------------------------------------
# 5. Dependencies (as the app user).
verify_deps() {
  local missing=0
  for p in \
    "node_modules/next/dist/bin/next" \
    "node_modules/.bin/prisma" \
    "node_modules/.bin/tsx"
  do
    [ -e "$APP_DIR/$p" ] || { echo "missing after npm ci: $p"; missing=1; }
  done
  [ "$missing" -eq 0 ]
}

if [ "$FRESH" -eq 1 ] || [ ! -d "$APP_DIR/node_modules" ]; then
  echo "[..] installing dependencies (npm ci)"
  app_run "npm ci"
elif ! verify_deps; then
  echo "[..] dependencies present but incomplete — reinstalling (npm ci)"
  app_run "npm ci"
else
  echo "[ok] dependencies installed (pass -Fresh to reinstall)"
fi

if ! verify_deps; then
  fail "dependencies are incomplete after npm ci. Run 'npm ci' manually to see the real error, then check disk space (df -h)."
fi
if ! out="$(app_run "node -e \"require('better-sqlite3')\"" 2>&1)"; then
  echo "error: better-sqlite3 does not load under node $(node -v):" >&2
  echo "$out" | sed 's/^/       /' >&2
  fail "on Debian/Ubuntu install build tools ('apt-get install build-essential python3') and re-run."
fi
NESTED="$APP_DIR/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3"
if [ -f "$NESTED/build/Release/better_sqlite3.node" ]; then
  if ! out="$(app_run "node -e \"require('$NESTED')\"" 2>&1)"; then
    echo "error: the better-sqlite3 copy under @prisma/adapter-better-sqlite3 does not load:" >&2
    echo "$out" | sed 's/^/       /' >&2
    fail "the nested native binary and the runtime Node must share an ABI."
  fi
fi

# ---------------------------------------------------------------------------
# 6. Schema, seed, build.
echo "[..] applying database schema"
app_run "npx prisma db push"

echo "[..] seeding admin account (idempotent)"
app_run "npm run seed"

echo "[..] building production bundle"
app_run "npm run build"
[ -f "$APP_DIR/.next/BUILD_ID" ] && [ -d "$APP_DIR/.next/server" ] \
  || fail "production build is incomplete (.next/BUILD_ID missing). Inspect 'npm run build' output above."

# ---------------------------------------------------------------------------
# 7. Make it run on boot (or start in the foreground on non-systemd boxes).
if [ "$NO_START" -eq 1 ]; then
  echo ""
  echo "== Installation ready (not started) =="
  echo "  service: sudo bash scripts/autorun.sh -Port $PORT -User $APP_USER"
  echo "  foreground: npm start -- -p $PORT"
elif command -v systemctl >/dev/null 2>&1 && { [ "$IS_ROOT" -eq 1 ] || [ "$HAVE_SUDO" -eq 1 ]; }; then
  echo "[..] installing systemd service (veritas.service, port $PORT)"
  run_priv "cd '$APP_DIR' && bash scripts/autorun.sh -Port $PORT -User $APP_USER"
else
  echo "[..] systemd unavailable — starting in the foreground"
  app_run "npm start -- -p $PORT"
fi

echo ""
echo "== Veritas installed =="
echo "  app     : $APP_DIR"
echo "  data    : $VERITAS_DB_FILE (+ snapshots under $VERITAS_DATA_DIR)"
echo "  url     : http://<this-host>:$PORT"
echo "  admin   : admin@veritas.local / admin123   (CHANGE THIS PASSWORD NOW)"
echo "  update  : sudo npm run update"
echo "  logs    : journalctl -u veritas -f"