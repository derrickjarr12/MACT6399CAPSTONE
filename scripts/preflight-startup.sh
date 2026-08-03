#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TMP_PORT="3100"
LOG_FILE="/tmp/pnf-preflight-startup.log"
PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" >/dev/null 2>&1 || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[preflight] 1/4 Build GUI"
npm run build:gui >/dev/null

echo "[preflight] 2/4 Validate startup env"
node -e "require('./src/config/validate-startup').validateStartup()" >/dev/null

echo "[preflight] 3/4 Boot API on temporary port ${TMP_PORT}"
PORT="$TMP_PORT" NODE_ENV=production node src/index.js >"$LOG_FILE" 2>&1 &
PID="$!"

echo "[preflight] 4/4 Check /health"
READY="false"
for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:${TMP_PORT}/health" >/dev/null 2>&1; then
    READY="true"
    break
  fi
  sleep 0.25
done

if [[ "$READY" != "true" ]]; then
  echo "[preflight] FAILED: /health did not become ready"
  echo "[preflight] Startup logs:"
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

echo "[preflight] PASS: startup checks completed successfully"
