#!/usr/bin/env bash
set -euo pipefail

# Veritas – one-time environment setup for production (Linux/macOS).
#
# Creates /opt/veritas/.env with a generated AUTH_SECRET plus email-verification
# settings, then reminds you how to deploy and restart the systemd service.
#
# Usage (from the project directory):
#   sudo -u veritas bash scripts/setup-env.sh                # default user: veritas
#   sudo -u veritas bash scripts/setup-env.sh --user appuser # run as another service user
#   sudo bash scripts/setup-env.sh --force                   # overwrite an existing .env (careful)

ENV_FILE=".env"
SERVICE_USER="veritas"
FORCE=0

cd "$(dirname "$0")/.."

strip_dashes() { echo "${1#--}" | sed 's/^-//'; }

while [[ $# -gt 0 ]]; do
  key="$(strip_dashes "$1" | tr '[:upper:]' '[:lower:]')"
  case "$key" in
    user)
      SERVICE_USER="$2"
      shift 2
      ;;
    force)
      FORCE=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: bash scripts/setup-env.sh [--user NAME] [--force]"
      exit 1
      ;;
  esac
done

if [ -f "$ENV_FILE" ] && [ "$FORCE" -eq 0 ]; then
  echo "error: $ENV_FILE already exists. Refusing to overwrite." >&2
  echo "       Add any missing keys to it, or re-run with --force." >&2
  exit 1
fi

# --- Resend / email settings (edit these to your real values) -------------
# MAIL_FROM must be (or share a domain with) a sender you verified in Resend.
# VERITAS_BASE_URL is the public URL students use; it's the domain in the link.
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MAIL_FROM="Veritas <onboarding@yourdomain.com>"
VERITAS_BASE_URL="https://exams.yourschool.com"
# --------------------------------------------------------------------------

SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

MASKED_KEY="re_$(printf '%s' "$RESEND_API_KEY" | sed 's/^re_//' | sed 's/./x/g')"
[ -z "$MASKED_KEY" ] && MASKED_KEY="re_xxxxxxxx"

cat > "$ENV_FILE" <<EOF
AUTH_SECRET=$SECRET
RESEND_API_KEY=$RESEND_API_KEY
MAIL_FROM="$MAIL_FROM"
VERITAS_BASE_URL=$VERITAS_BASE_URL
EOF

# The service runs as $SERVICE_USER; make sure it can read .env. autorun.sh
# only auto-chowns $APP_DIR/.next/prisma, never .env, so this step matters.
if id "$SERVICE_USER" >/dev/null 2>&1; then
  chown "$SERVICE_USER" "$ENV_FILE"
else
  echo "warning: user '$SERVICE_USER' not found; skipping chown (fix ownership yourself)." >&2
fi
chmod 600 "$ENV_FILE"

echo ""
echo "== .env created ($(pwd)/$ENV_FILE) =="
echo "  AUTH_SECRET          = $SECRET"
echo "  RESEND_API_KEY       = $MASKED_KEY  <-- SET YOUR REAL KEY"
echo "  MAIL_FROM            = $MAIL_FROM    <-- verify sender in Resend"
echo "  VERITAS_BASE_URL     = $VERITAS_BASE_URL  <-- set to your public URL"
echo ""
echo "Edit the placeholders now before deploying:  nano $ENV_FILE"
echo ""
echo "Then apply and restart the service:"
echo "  sudo -u $SERVICE_USER npm run deploy -- -NoStart"
echo "  sudo systemctl restart veritas"
echo "  # confirm it loaded:"
echo "  sudo tr '\\0' '\\n' < \"/proc/\$(systemctl show -p MainPID --value veritas)/environ\" | grep -E 'AUTH_SECRET|RESEND|MAIL_FROM|VERITAS'"
