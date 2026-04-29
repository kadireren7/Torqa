#!/usr/bin/env sh
# Call Torqa dashboard cron tick (requires TORQA_CRON_SECRET and DASHBOARD_URL).
set -eu
URL="${DASHBOARD_URL:-http://127.0.0.1:3000}/api/scan-schedules/cron/tick"
SECRET="${TORQA_CRON_SECRET:?Set TORQA_CRON_SECRET}"
curl -sS -X POST "$URL" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{}'
