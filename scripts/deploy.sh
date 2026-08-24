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
else
  echo "[ok] dependencies installed (pass -Fresh to reinstall)"
fi

# 4. Database
echo "[..] applying database schema"
npx prisma db push

echo "[..] seeding admin account (idempotent)"
npm run seed

# 5. Build
echo "[..] building production bundle"
npm run build

echo ""
echo "== Deployment ready =="
if [ "$NO_START" -eq 1 ]; then
  echo "Start the server with: npm start -- -p $PORT"
else
  echo "Starting server on http://localhost:$PORT (Ctrl+C to stop)"
  npm start -- -p "$PORT"
fi
