#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

mkdir -p "$BACKEND_DIR" "$ROOT_DIR/local-backend/data"

ensure_repo() {
  local path="$1"
  local url="$2"

  if [[ -d "$path/.git" ]]; then
    git -C "$path" pull --ff-only
    return
  fi

  rm -rf "$path"
  git clone --depth 1 --single-branch --filter=blob:none "$url" "$path"
}

ensure_repo "$BACKEND_DIR/languagetool" "https://github.com/languagetool-org/languagetool.git"
ensure_repo "$BACKEND_DIR/sinonims-cat" "https://github.com/Softcatala/sinonims-cat.git"

if [[ ! -f "$ROOT_DIR/.env.vm" ]]; then
  cp "$ROOT_DIR/.env.vm.example" "$ROOT_DIR/.env.vm"
  echo "Created $ROOT_DIR/.env.vm from template. Edit domains and email before deploy."
fi

echo ""
echo "Repositories are ready in:"
echo "- $BACKEND_DIR/languagetool"
echo "- $BACKEND_DIR/sinonims-cat"
echo ""
echo "Next:"
echo "1) Edit .env.vm"
echo "2) docker compose --env-file .env.vm -f compose.vm.yml up -d"
