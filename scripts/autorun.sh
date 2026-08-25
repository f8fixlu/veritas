#!/usr/bin/env bash
set -euo pipefail

# Veritas auto-start for Debian/Ubuntu — installs a systemd service that
# starts the production server on boot and restarts it if it crashes.
#
# Usage (from the project directory):
#   sudo bash scripts/autorun.sh                       # install & start on port 3000
#   sudo bash scripts/autorun.sh -Port 8080            # custom port
#   sudo bash scripts/autorun.sh -User veritas         # run as a specific user
#   sudo bash scripts/autorun.sh -Uninstall            # remove the service
#   (also accepts --port / --user / --uninstall)

PORT="3000"
SERVICE_USER=""
UNINSTALL=0
SERVICE_NAME="veritas"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    port)
      PORT="$2"
      shift 2
      ;;
    user)
      SERVICE_USER="$2"
      shift 2
      ;;
    uninstall)
      UNINSTALL=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: sudo bash scripts/autorun.sh [-Port N] [-User NAME] [-Uninstall]"
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "error: run as root: sudo bash scripts/autorun.sh ..." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "error: systemd not found — this helper targets Debian/Ubuntu systems." >&2
  exit 1
fi

UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$UNINSTALL" -eq 1 ]; then
  systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$UNIT"
  systemctl daemon-reload
  echo "[ok] ${SERVICE_NAME} service removed (application files untouched)"
  exit 0
fi

# 1. Runtime prerequisites
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "error: node was not found in PATH." >&2
  exit 1
fi

NEXT_BIN="$APP_DIR/node_modules/next/dist/bin/next"
if [ ! -f "$NEXT_BIN" ]; then
  echo "error: dependencies are missing ($NEXT_BIN not found)." >&2
  echo "       run 'npm ci && npm run build' or 'npm run deploy -- -NoStart' first." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/.next" ]; then
  echo "error: no production build found ($APP_DIR/.next)." >&2
  echo "       run 'npm run build' or 'npm run deploy -- -NoStart' first." >&2
  exit 1
fi

# 2. Which user should run the service?
if [ -z "$SERVICE_USER" ]; then
  if id veritas >/dev/null 2>&1; then
    SERVICE_USER="veritas"
  elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    SERVICE_USER="$SUDO_USER"
  else
    SERVICE_USER="root"
  fi
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "error: user '$SERVICE_USER' does not exist." >&2
  exit 1
fi

for DIR in "$APP_DIR" "$APP_DIR/.next" "$APP_DIR/prisma"; do
  if [ -d "$DIR" ] && ! sudo -u "$SERVICE_USER" test -r "$DIR" 2>/dev/null; then
    echo "warning: user '$SERVICE_USER' cannot read $DIR — fixing ownership"
    chown -R "$SERVICE_USER" "$DIR"
  fi
done

# 3. Write the unit (Next.js loads $APP_DIR/.env itself; the EnvironmentFile
#    line is a safety net for anything read before Next boots, e.g. logging).
cat > "$UNIT" <<EOF
[Unit]
Description=Veritas online exam system
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
ExecStart=${NODE_BIN} ${NEXT_BIN} start -p ${PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

# 4. Enable + start
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo ""
echo "== Auto-start installed ==" 
echo "  service : systemctl status $SERVICE_NAME"
echo "  logs    : journalctl -u $SERVICE_NAME -f"
echo "  url     : http://localhost:$PORT"
echo "  remove  : sudo bash scripts/autorun.sh -Uninstall"

# 5. Quick health check (non-fatal if the app is still booting)
sleep 3
if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/login" 2>/dev/null; then
  echo "[ok] server responds on port $PORT"
else
  echo "note: server did not answer yet — check 'journalctl -u $SERVICE_NAME' if it stays down."
fi
