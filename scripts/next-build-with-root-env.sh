#!/usr/bin/env bash
# Run from apps/web (npm run build -w @stocksentry/web) or via remote-web-build.sh.
# Next inlines NEXT_PUBLIC_* at build time — always prefer monorepo-root .env.
set -euo pipefail
WEB_DIR="$(cd "$(dirname "$0")/../apps/web" && pwd)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
if [[ -z "${NEXT_PUBLIC_SHOPIFY_API_KEY:-}" && -n "${SHOPIFY_API_KEY:-}" ]]; then
  export NEXT_PUBLIC_SHOPIFY_API_KEY="$SHOPIFY_API_KEY"
fi
# Prefer root key over a stale nested apps/web/.env that may say UNSET_*
if [[ -n "${SHOPIFY_API_KEY:-}" && "${SHOPIFY_API_KEY}" != UNSET_* ]]; then
  export NEXT_PUBLIC_SHOPIFY_API_KEY="$SHOPIFY_API_KEY"
  export SHOPIFY_API_KEY
fi
if [[ -z "${NEXT_PUBLIC_SHOPIFY_API_KEY:-}" || "${NEXT_PUBLIC_SHOPIFY_API_KEY}" == UNSET_* ]]; then
  echo "error: SHOPIFY_API_KEY / NEXT_PUBLIC_SHOPIFY_API_KEY missing or UNSET — refusing web build" >&2
  exit 1
fi
cd "$WEB_DIR"
# Root .env often has NODE_ENV=development — never let that leak into next build
# (causes non-standard NODE_ENV warning and /404 Html prerender failures).
export NODE_ENV=production
exec ../../node_modules/.bin/next build "$@"
