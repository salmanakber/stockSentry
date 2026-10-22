#!/usr/bin/env bash
set -euo pipefail
ssh root@209.97.132.83 'cd /var/www/stockSentry && git pull --ff-only && npm install && npx prisma db push --schema packages/database/prisma/schema.prisma && npm run build && pm2 reload ecosystem.config.cjs --update-env && pm2 list'
