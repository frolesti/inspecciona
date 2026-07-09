#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <corrector-url> <sinonims-url>"
  echo "Example: $0 https://corrector.example.org/v2/check https://sinonims.example.org/sinonims-api/search/felic"
  exit 1
fi

CORRECTOR_URL="$1"
SINONIMS_URL="$2"

curl -fsS -X POST "$CORRECTOR_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "text=prova&language=ca-ES" >/dev/null

echo "Corrector OK"

curl -fsS "$SINONIMS_URL" >/dev/null

echo "Sinonims OK"
