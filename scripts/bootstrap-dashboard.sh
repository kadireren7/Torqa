#!/usr/bin/env bash
set -euo pipefail

WITH_SUPABASE="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing dashboard dependencies"
(
  cd "$REPO_ROOT/dashboard"
  npm install
)

if [[ "$WITH_SUPABASE" == "--with-supabase" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "Missing required command: supabase" >&2
    exit 1
  fi
  echo "==> Starting local Supabase and applying migrations"
  (
    cd "$REPO_ROOT"
    supabase start
    supabase db reset
  )
fi

echo "==> Bootstrap complete"
echo "Run: cd dashboard && npm run dev"
if [[ "$WITH_SUPABASE" == "--with-supabase" ]]; then
  echo "Supabase local stack is running with fresh migrations."
fi
