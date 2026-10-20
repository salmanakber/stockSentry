#!/usr/bin/env bash
set -euo pipefail
cd /var/www/stockSentry/apps/web
export NODE_ENV=production
exec ../../node_modules/.bin/next build
