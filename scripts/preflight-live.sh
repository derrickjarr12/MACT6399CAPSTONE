#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   APP_URL="https://your-app.ondigitalocean.app" npm run preflight:live
# or
#   npm run preflight:live -- https://your-app.ondigitalocean.app

APP_URL="${APP_URL:-${1:-}}"

if [[ -z "$APP_URL" ]]; then
  echo "[preflight-live] ERROR: missing app URL"
  echo "[preflight-live] Usage: APP_URL=\"https://your-app.ondigitalocean.app\" npm run preflight:live"
  echo "[preflight-live]    or: npm run preflight:live -- https://your-app.ondigitalocean.app"
  exit 1
fi

APP_URL="${APP_URL%/}"
HEALTH_URL="${APP_URL}/health"
ROOT_URL="${APP_URL}/"

TMP_HEALTH="/tmp/pnf-preflight-live-health.json"

echo "[preflight-live] 1/3 Check /health HTTP status"
HEALTH_STATUS=$(curl -sS -o "$TMP_HEALTH" -w "%{http_code}" --max-time 12 "$HEALTH_URL" || true)
if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo "[preflight-live] FAILED: /health returned HTTP ${HEALTH_STATUS}"
  [[ -f "$TMP_HEALTH" ]] && cat "$TMP_HEALTH" || true
  exit 1
fi

echo "[preflight-live] 2/3 Check /health body"
if ! grep -qi '"ok"[[:space:]]*:[[:space:]]*true' "$TMP_HEALTH"; then
  echo "[preflight-live] FAILED: /health does not include ok:true"
  cat "$TMP_HEALTH" || true
  exit 1
fi

echo "[preflight-live] 3/3 Check app root responds"
ROOT_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$ROOT_URL" || true)
if [[ "$ROOT_STATUS" != "200" ]]; then
  echo "[preflight-live] FAILED: app root returned HTTP ${ROOT_STATUS}"
  exit 1
fi

echo "[preflight-live] PASS: live app checks completed successfully"
