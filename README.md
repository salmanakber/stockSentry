# StockSentry (Bundle Safety)

Shopify embedded app for **read-only** inventory monitoring, incident investigation, and bundle-related risk awareness. The product brand in the UI is **Bundle Safety**; this repository is named StockSentry.

> **Honesty:** Bundle Safety observes Shopify inventory signals and surfaces evidence-backed incidents. It does **not** invent baselines, write inventory corrections, or claim oversell prevention.

## Architecture overview

```
Shopify Admin (embedded)
        │  session token / App Bridge
        ▼
   apps/web  (Next.js :3000)  ──REST──▶  apps/api  (Express :4000)
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                  PostgreSQL            apps/worker           Shopify Admin
                  (Prisma)              (pg-boss jobs)        GraphQL (read)
```

| Path | Role |
|------|------|
| `apps/web` | Next.js 15 App Router embedded admin UI |
| `apps/api` | Express REST API (`/api/v1/*`), OAuth (`/auth`), webhooks (`/webhooks/shopify`) |
| `apps/worker` | pg-boss background worker (webhooks, reconcile, detection, AI, notify, export) |
| `packages/database` | Prisma schema + client (`@stocksentry/database`) |
| `packages/shared` | Zod schemas, detection math, plan entitlements |
| `designExample/` | UI mockups (preserved) |
| `building-document/` | Product & engineering context (preserved) |

**Tenant model:** every operational table is scoped by `shopId`. Auth middleware resolves the merchant from a Shopify session token and attaches `req.shop` / `req.shopId`.

**Billing:** Free / Starter / Pro entitlements live in `@stocksentry/shared`. Paid plans use Shopify Billing (`appSubscriptionCreate`) stubs; server soft-enforces monitored-item caps and AI report quotas with clear `ENTITLEMENT_*` error codes.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm 10+ (workspaces)

## Local setup

1. Copy environment placeholders:

   ```bash
   cp .env.example .env
   ```

2. Fill required values (see [`.env.example`](.env.example)):

   - `DATABASE_URL`
   - `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`
   - `SESSION_SECRET` (long random string)
   - `APP_URL` (API, e.g. `https://localhost:4000`)
   - `EMBEDDED_APP_URL` / `NEXT_PUBLIC_*` (web, e.g. `https://localhost:3000`)
   - Optional: `OPENAI_API_KEY` for AI incident reports

3. Install and prepare the database:

   ```bash
   npm install
   npm run db:generate
   npm run db:push
   ```

4. Start development (from repo root — runs workspace `dev` scripts):

   ```bash
   npm run dev
   ```

   Or per process:

   ```bash
   npm run dev -w @stocksentry/api
   npm run dev -w @stocksentry/web
   npm run dev -w @stocksentry/worker
   ```

5. Run tests / build:

   ```bash
   npm test
   npm run build
   ```

## Shopify Partner app setup

1. Create an app in [Shopify Partners](https://partners.shopify.com/) (or Dev Dashboard).
2. Set **App URL** to your embedded web origin (`EMBEDDED_APP_URL`).
3. **Allowed redirection URLs** (match `shopify.app.toml` / API host):

   - `https://<API_HOST>/auth`
   - `https://<API_HOST>/auth/callback`
   - `https://<API_HOST>/api/auth`

4. **Scopes** (read-only): `read_inventory`, `read_products`, `read_locations`.
5. **Webhooks** → delivery URL `https://<API_HOST>/webhooks/shopify`:

   | Topic | Purpose |
   |-------|---------|
   | `inventory_levels/update` (+ connect/disconnect) | Quantity observations |
   | `products/update`, `products/delete` | Catalog sync |
   | `app/uninstalled` | Full operational wipe |
   | `customers/data_request`, `customers/redact`, `shop/redact` | Mandatory privacy / GDPR |

6. Copy Client ID / Secret into `.env` as `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` (and `NEXT_PUBLIC_SHOPIFY_API_KEY`).
7. Install the app on a development store and open it from Admin so offline session exchange can complete.

See also [`shopify.app.toml`](shopify.app.toml).

## Deploy to DigitalOcean (`/var/www/stockSentry`)

Documented end-to-end in **[DEPLOY.md](DEPLOY.md)** (Nginx reverse proxy for `:4000` / `:3000`, PM2, Postgres).

Short path on the server:

```bash
cd /var/www/stockSentry
git pull origin main
npm install
npm run db:generate
npm run db:push
npm run build
pm2 start ecosystem.config.cjs   # or: pm2 reload ecosystem.config.cjs
```

PM2 processes: `stocksentry-api`, `stocksentry-web`, `stocksentry-worker`.

## Limitations

- **Read-only** toward Shopify inventory — no quantity writes or “fixes”.
- **No invented data** — detection and AI reports use observed evidence only; missing baselines stay unknown.
- Bundle groups are **manual** (no third-party bundle-app auto-discovery yet).
- Billing GraphQL helpers are **production-shaped stubs**; confirm charges in Partner test mode before going live.
- Live dashboard data requires a completed merchant install and valid env secrets; otherwise the UI shows empty / onboarding states (not sample marketing numbers).

## Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run build` | Build all workspaces |
| `npm run dev` | Dev scripts across workspaces |
| `npm run test` | Vitest (shared detection + tenant helpers) |
| `npm run lint` | Lint / typecheck workspaces |
| `npm run db:generate` | Prisma generate |
| `npm run db:migrate` | Prisma migrate |
| `npm run db:push` | Prisma db push |

## License / status

Private monorepo. Brand: Bundle Safety.
