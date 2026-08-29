#!/usr/bin/env bash
set -euo pipefail

# Veritas production deployment (Linux/macOS)
# Usage: bash scripts/deploy.sh [-Port 3000] [-Fresh] [-NoStart] [-InitEnv]
#        (also accepts --port, --fresh, --no-start, --init-env)

PORT="3000"
FRESH=0
NO_START=0
INIT_ENV=0

cd "$(dirname "$0")/.."

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    port)
      PORT="$2"
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
    initenv)
      INIT_ENV=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/deploy.sh [-Port N] [-Fresh] [-NoStart] [-InitEnv]"
      exit 1
      ;;
  esac
done

echo "== Veritas deployment =="

fail() { echo "error: $*" >&2; exit 1; }

# Packages the build and seed rely on. We verify every one of these after
# npm ci so a broken/partial install fails with a clear message instead of a
# bare 'next: command not found' midway through. (better-sqlite3 v13 ships
# prebuilt .node files under prebuilds/ — we prove it loads via the
# require('better-sqlite3') check below.)
verify_deps() {
  local missing=0
  for p in \
    "node_modules/next/dist/bin/next" \
    "node_modules/.bin/prisma" \
    "node_modules/.bin/tsx"
  do
    if [ ! -e "$p" ]; then
      echo "missing after npm ci: $p"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ]
}

[ -f "package.json" ] || fail "package.json missing — run this from the app directory."
[ -f "package-lock.json" ] || fail "package-lock.json missing — run 'npm install' once to generate it (then commit it)."

# 1. Node version
if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js is not installed." >&2
  exit 1
fi
NODE_VER="$(node -v)"
MINOR_OK="$(printf '%s\n' "v20.9.0" "$NODE_VER" | sort -V | head -n1)"
if [ "$MINOR_OK" != "v20.9.0" ]; then
  echo "error: Node.js 20.9 or newer is required (found $NODE_VER)." >&2
  exit 1
fi
echo "[ok] Node $NODE_VER"

# 2. Environment (.env holds AUTH_SECRET; Next.js loads it automatically)
ENV_FILE=".env"
if [ "$INIT_ENV" -eq 1 ] && [ ! -f "$ENV_FILE" ]; then
  SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  printf 'AUTH_SECRET=%s' "$SECRET" > "$ENV_FILE"
  echo "[ok] created .env with a generated AUTH_SECRET"
fi
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r k v; do
    [ -z "$k" ] && continue
    case "$k" in \#*) continue ;; esac
    v="${v%\"}"
    v="${v#\"}"
    export "$k=$v"
  done < <(tr -d '\r' < "$ENV_FILE")
  echo "[ok] loaded .env"
else
  echo "warning: .env not found - the built-in development AUTH_SECRET will be used." >&2
  echo "warning: run 'npm run deploy -- -InitEnv' once to generate a production secret." >&2
fi

# 3. Dependencies
if [ "$FRESH" -eq 1 ] || [ ! -d node_modules ]; then
  echo "[..] installing dependencies (npm ci)"
  npm ci
elif ! verify_deps; then
  echo "[..] dependencies present but incomplete — reinstalling (npm ci)"
  npm ci
else
  echo "[ok] dependencies installed (pass -Fresh to reinstall)"
fi
if [ ! -e node_modules/next/dist/bin/next ]; then
  echo "warning: 'next' was not installed by npm ci — retrying once"
  npm ci
fi
if ! verify_deps; then
  echo "dependencies are incomplete after npm ci." >&2
  echo "Run 'npm ci' manually to see the real error, then check disk space (df -h)." >&2
  fail "npm ci failed to install one or more required packages."
fi
# Prove the native module actually loads under this node before continuing.
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
  fail "better-sqlite3 does not load under node $(node -v). If its prebuilt binary is missing, install build tools and run 'npm rebuild better-sqlite3 --build-from-source'."
fi

# 4. Database
if [ -n "${VERITAS_DB_FILE:-}" ]; then
  mkdir -p "$(dirname "$VERITAS_DB_FILE")"
  echo "[ok] database file: $VERITAS_DB_FILE"
fi
echo "[..] applying database schema"
npx prisma db push

echo "[..] seeding admin account (idempotent)"
npm run seed

# 5. Build
echo "[..] building production bundle"
npm run build
[ -f ".next/BUILD_ID" ] && [ -d ".next/server" ] \
  || fail "production build is incomplete (.next/BUILD_ID missing). Inspect the 'npm run build' output above for the real error."

echo ""
echo "== Deployment ready =="
if [ "$NO_START" -eq 1 ]; then
  echo "Start the server with: npm start -- -p $PORT"
else
  echo "Starting server on http://localhost:$PORT (Ctrl+C to stop)"
  npm start -- -p "$PORT"
fi
