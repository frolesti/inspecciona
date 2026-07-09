#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/vm-loadtest.sh [base_url] [concurrency] [requests]
# Example:
#   ./scripts/vm-loadtest.sh https://corrector.34.118.197.141.nip.io 100 600

BASE_URL="${1:-https://corrector.34.118.197.141.nip.io}"
CONCURRENCY="${2:-100}"
REQUESTS="${3:-600}"

run_burst() {
  local name="$1"
  local cmd="$2"

  echo ""
  echo "=== $name ==="
  echo "target=$BASE_URL concurrency=$CONCURRENCY requests=$REQUESTS"
  local start end elapsed
  start="$(date +%s)"

  # shellcheck disable=SC2086
  seq 1 "$REQUESTS" | xargs -P"$CONCURRENCY" -I{} sh -lc "$cmd" | sort | uniq -c

  end="$(date +%s)"
  elapsed="$((end - start))"
  if [[ "$elapsed" -lt 1 ]]; then
    elapsed=1
  fi
  local rps
  rps="$((REQUESTS / elapsed))"
  echo "elapsed=${elapsed}s approx_rps=${rps}"
}

run_burst \
  "Corrector /v2/check" \
  "curl -k -s -o /dev/null -w '%{http_code}\\n' -X POST '$BASE_URL/v2/check' -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode 'text=Aixo es una prova curta' --data-urlencode 'language=ca-ES'"

run_burst \
  "Sinonims /sinonims-api/search/casa" \
  "curl -k -s -o /dev/null -w '%{http_code}\\n' '$BASE_URL/sinonims-api/search/casa'"

run_burst \
  "Autocomplete /sinonims-api/autocomplete/ca" \
  "curl -k -s -o /dev/null -w '%{http_code}\\n' '$BASE_URL/sinonims-api/autocomplete/ca'"


echo ""
echo "If you don't get almost all 200 responses, lower concurrency or scale VM/resources."
