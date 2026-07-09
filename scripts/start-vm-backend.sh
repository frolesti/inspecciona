#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.vm" ]]; then
  echo "Missing .env.vm. Create it from .env.vm.example first."
  exit 1
fi

bash scripts/setup-vm-backend.sh

sudo docker compose --env-file .env.vm -f compose.vm.yml up -d

echo ""
echo "Services launched."
echo "Check status: sudo docker compose --env-file .env.vm -f compose.vm.yml ps"
echo "Tail logs:     sudo docker compose --env-file .env.vm -f compose.vm.yml logs -f"
