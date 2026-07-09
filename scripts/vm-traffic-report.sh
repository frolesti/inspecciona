#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/vm-traffic-report.sh [hours] [avg_requests_per_user_per_day]
# Example:
#   ./scripts/vm-traffic-report.sh 24 8

HOURS="${1:-24}"
REQ_PER_USER_DAY="${2:-8}"
LOG_FILE="/var/log/caddy/corrector-access.log"
CONTAINER_NAME="inspecciona-caddy-1"

if ! sudo docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Container $CONTAINER_NAME is not running"
  exit 1
fi

TMP_LOG="$(mktemp)"
trap 'rm -f "$TMP_LOG"' EXIT

if ! sudo docker exec "$CONTAINER_NAME" sh -lc "test -f '$LOG_FILE'"; then
  echo "Missing $LOG_FILE inside $CONTAINER_NAME"
  echo "Enable caddy log block in deploy/Caddyfile and restart caddy."
  exit 1
fi

sudo docker exec "$CONTAINER_NAME" sh -lc "cat '$LOG_FILE'" > "$TMP_LOG"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. Install jq for time-filtered reports: sudo apt-get install -y jq"
  echo "Showing totals from current log file (not time-filtered)."

  total="$(wc -l < "$TMP_LOG" | tr -d ' ')"
  check_count="$(grep -c '"uri":"/v2/check"' "$TMP_LOG" || true)"
  syn_count="$(grep -c '"uri":"/sinonims-api/search/' "$TMP_LOG" || true)"
  auto_count="$(grep -c '"uri":"/sinonims-api/autocomplete/' "$TMP_LOG" || true)"
  unique_ips="$(awk -F'"remote_ip":"' '/"remote_ip":"/{split($2,a,"\""); print a[1]}' "$TMP_LOG" | sort -u | wc -l | tr -d ' ')"
else
  now="$(date -u +%s)"
  since="$((now - HOURS * 3600))"

  total="$(jq --argjson since "$since" -r 'select((.ts // 0) >= $since) | 1' "$TMP_LOG" | wc -l | tr -d ' ')"
  check_count="$(jq --argjson since "$since" -r 'select((.ts // 0) >= $since and .request.uri == "/v2/check") | 1' "$TMP_LOG" | wc -l | tr -d ' ')"
  syn_count="$(jq --argjson since "$since" -r 'select((.ts // 0) >= $since and (.request.uri | startswith("/sinonims-api/search/"))) | 1' "$TMP_LOG" | wc -l | tr -d ' ')"
  auto_count="$(jq --argjson since "$since" -r 'select((.ts // 0) >= $since and (.request.uri | startswith("/sinonims-api/autocomplete/"))) | 1' "$TMP_LOG" | wc -l | tr -d ' ')"
  unique_ips="$(jq --argjson since "$since" -r 'select((.ts // 0) >= $since) | .request.remote_ip // empty' "$TMP_LOG" | sort -u | wc -l | tr -d ' ')"
fi

if [[ "$HOURS" -lt 1 ]]; then
  HOURS=24
fi

daily_reqs="$(awk -v req="$total" -v h="$HOURS" 'BEGIN { printf "%.2f", (req * 24.0) / h }')"
est_daily_users="$(awk -v reqd="$daily_reqs" -v rpu="$REQ_PER_USER_DAY" 'BEGIN { if (rpu <= 0) print 0; else printf "%.2f", reqd / rpu }')"

echo ""
echo "Traffic window: ${HOURS}h"
echo "Total requests: $total"
echo "Corrector /v2/check: $check_count"
echo "Sinonims /search: $syn_count"
echo "Sinonims /autocomplete: $auto_count"
echo "Unique IPs (proxy for active users): $unique_ips"
echo "Projected requests/day: $daily_reqs"
echo "Estimated daily users (req/user/day=$REQ_PER_USER_DAY): $est_daily_users"
