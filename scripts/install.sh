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
# repo, moves onto the latest GitHub release (vX.Y.Z tag), creates the system
# user + .env (external data layout under /var/lib/veritas), runs
# npm ci / prisma db push / seed / build as that user, then installs the
# veritas.service and starts it (unless -NoStart).

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

# Restore app ownership to the app user so everything run here (via app_run)
# can write the app tree. Runs BEFORE the git sync too: git fetch/checkout run
# as the app user, so a .git left root-owned (e.g. a checkout cloned or
# initialized under sudo) fails with 'insufficient permission' on .git/objects.
# Best-effort, idempotent.
fix_app_ownership() {
  if [ "$IS_ROOT" -eq 1 ] && [ "$APP_USER" != "root" ]; then
    chown "$APP_USER" "$APP_DIR" 2>/dev/null || true
    for d in "node_modules" ".next" "src" "prisma" "data"; do
      [ -e "$APP_DIR/$d" ] && chown -R "$APP_USER" "$APP_DIR/$d" 2>/dev/null || true
    done
    [ -d "$APP_DIR/.git" ] && chown -R "$APP_USER" "$APP_DIR/.git" 2>/dev/null || true
    for f in "package.json" "package-lock.json" ".env"; do
      [ -f "$APP_DIR/$f" ] && chown "$APP_USER" "$APP_DIR/$f" 2>/dev/null || true
    done
  fi
}

# Remove stray untracked TypeScript files left at the app root. tsconfig.json
# includes "**/*.ts", so `next build` type-checks every top-level .ts/.tsx/.mts
# file in the tree; a working-tree leftover (e.g. backfill-student-codes.ts
# copied out of scripts/ beside package.json) has ../src imports that cannot
# resolve from the root and aborts the build. Only a file that is untracked AND
# shares a basename with a tracked file elsewhere is removed, so real config
# (next.config.ts) and the gitignored next-env.d.ts are never touched.
remove_stray_root_ts() {
  local f name tracked
  for f in "$APP_DIR"/*.ts "$APP_DIR"/*.tsx "$APP_DIR"/*.mts; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    if git -C "$APP_DIR" ls-files --error-unmatch -- "$name" >/dev/null 2>&1; then
      continue
    fi
    tracked="$(git -C "$APP_DIR" ls-files -- "*/$name" 2>/dev/null | head -n1)" || true
    [ -n "$tracked" ] || continue
    echo "[..] removing stray untracked $name at the app root (duplicate of $tracked)"
    rm -f "$f"
  done
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

# Sync an existing checkout to the latest GitHub release: always apply the
# newest published release tag (vX.Y.Z), never the head of origin/<branch>, so
# the app never runs unreleased code. Local edits are stashed (kept, never
# lost), diverged history is backed up as a branch, then the current branch is
# re-pointed at the release (falling back to origin/<branch> only when no tags
# can be fetched). .env, the SQLite DB and /data are gitignored, so nothing
# that matters is ever touched.
sync_latest() {
  # Self-heal a checkout copied in without git metadata: initialize a repo,
  # snapshot the current state (so rollback works), and add origin so the
  # latest release can always be fetched.
  if ! git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    echo "[..] no git repository here — initializing one (current state saved as a snapshot commit)"
    if ! app_run "git init -q && git branch -M main && git config user.name 'veritas-deploy' && git config user.email 'deploy@veritas.local' && git add -A && (git diff --cached --quiet 2>/dev/null || git commit -q -m 'veritas pre-install state $(date +%F-%H%M%S)')"; then
      fail "could not initialize a git repository in $APP_DIR"
    fi
  fi
  if [ -z "$(git -C "$APP_DIR" remote 2>/dev/null)" ]; then
    echo "[..] no git remote configured — adding origin $REPO"
    app_run "git remote add origin '$REPO'" \
      || echo "warning: could not add origin $REPO — using the checked-out code." >&2
  fi
  if ! git -C "$APP_DIR" remote >/dev/null 2>&1; then
    echo "warning: no git remote configured — using the checked-out code." >&2
    return 0
  fi
  local branch target fetched
  branch="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  [ "$branch" = "HEAD" ] && branch="main"
  target=""
  fetched=0
  echo "[..] fetching release tags from origin"
  if app_run "git fetch origin --tags"; then
    fetched=1
  elif [ "$IS_ROOT" -eq 1 ] && git -C "$APP_DIR" fetch origin --tags; then
    # The app user could not write .git (root-owned checkout the chown could
    # not reach). Retry as root so the refs are fresh — a stale origin ref must
    # never be used to fabricate an "already at the latest release" result.
    echo "note: git fetch failed as $APP_USER — retried as root (check .git ownership)." >&2
    fetched=1
  else
    echo "warning: could not fetch from origin — the checkout is NOT synced to the latest release; continuing with the current code." >&2
  fi
  if [ "$fetched" -eq 1 ]; then
    target="$(git -C "$APP_DIR" tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname 2>/dev/null | head -n1)"
    if [ -n "$target" ]; then
      echo "[ok] latest GitHub release : $target"
    else
      echo "warning: no release tags found — falling back to origin/$branch." >&2
    fi
  fi
  # Only fall back to origin/$branch when the fetch actually succeeded; on a
  # failed fetch the ref is stale and must not drive the checkout decision.
  if [ -z "$target" ] && [ "$fetched" -eq 1 ]; then
    if git -C "$APP_DIR" rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
      target="origin/$branch"
    else
      echo "warning: origin/$branch does not exist — using the checked-out code." >&2
      return 0
    fi
  fi
  local head tgt
  head="$(git -C "$APP_DIR" rev-parse HEAD)"
  tgt="$(git -C "$APP_DIR" rev-parse "$target")"
  if [ "$head" = "$tgt" ]; then
    echo "[ok] already at the latest release ($(git -C "$APP_DIR" rev-parse --short HEAD))"
    return 0
  fi
  if ! app_run "git merge-base --is-ancestor HEAD $target"; then
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
  if ! app_run "git checkout -B $branch $target"; then
    fail "could not move the checkout to $target"
  fi
  echo "[ok] applied release $target ($(git -C "$APP_DIR" rev-parse --short HEAD))"
  if [ -n "$stash_msg" ]; then
    echo "     local edits kept in stash '$stash_msg' (see: git stash list)" >&2
  fi
}

# ---------------------------------------------------------------------------
# 3. Get the code. Ensure the app user owns the tree (incl. any pre-existing
# .git) before the git fetch/checkout below runs as that user.
fix_app_ownership
if [ "$IN_PLACE" -eq 1 ]; then
  echo "[ok] code      : running from existing checkout at $APP_DIR"
  sync_latest
else
  if [ -e "$APP_DIR/package.json" ]; then
    if git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
      echo "[..] existing checkout at $APP_DIR — syncing to the latest release"
      sync_latest
    else
      echo "[..] existing app files at $APP_DIR (no git repo) — initializing and syncing to the latest release"
      sync_latest
    fi
  else
    [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ] \
      && fail "target $APP_DIR exists and is not empty — install into an empty folder (-Dir)."
    need_dir "$(dirname "$APP_DIR")"
    need_dir "$APP_DIR"
    echo "[..] cloning $REPO -> $APP_DIR"
    app_run "git clone '$REPO' '.'" || fail "git clone failed — check your network and '$REPO'."
    echo "[..] moving onto the latest release"
    sync_latest
  fi
fi

cd "$APP_DIR"

# A pre-existing checkout may carry stray untracked TypeScript files at the app
# root that would be type-checked (and fail) by the build below.
remove_stray_root_ts

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

# npm ci wipes node_modules and re-fetches everything; a corrupt persistent
# npm cache can ship a broken native binary and crash mid-install (e.g.
# SIGILL / Illegal instruction on a package postinstall). Retry once with a
# cleared cache before declaring failure.
npm_ci() {
  if app_run "npm ci"; then
    return 0
  fi
  echo "      npm ci failed — clearing the npm cache ($APP_NPM_CACHE) and retrying once." >&2
  app_run "npm cache clean --force" || \
    echo "warning: could not clean the npm cache ($APP_NPM_CACHE)." >&2
  app_run "npm ci"
}

if [ "$FRESH" -eq 1 ] || [ ! -d "$APP_DIR/node_modules" ]; then
  echo "[..] installing dependencies (npm ci)"
  npm_ci
elif ! verify_deps; then
  echo "[..] dependencies present but incomplete — reinstalling (npm ci)"
  npm_ci
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