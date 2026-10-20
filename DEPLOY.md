# Deploy — DigitalOcean + Nginx + PM2

Target layout on the droplet:

```
/var/www/stockSentry          # git clone of this repo
  apps/api     → :4000
  apps/web     → :3000
  apps/worker  → background (no HTTP)
```

## 1. Server prep

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm i -g pm2

# Postgres (if not already present)
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser -P stocksentry   # set a password
sudo -u postgres createdb -O stocksentry stocksentry
```

## 2. Clone & env

```bash
sudo mkdir -p /var/www/stockSentry
sudo chown "$USER":"$USER" /var/www/stockSentry
cd /var/www/stockSentry
git clone https://github.com/salmanakber/stockSentry.git .
cp .env.example .env
# Edit .env — never commit secrets
```

Required production keys:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | `postgresql://stocksentry:PASSWORD@localhost:5432/stocksentry` |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Partner app credentials |
| `SESSION_SECRET` | Long random string |
| `APP_URL` | Public API origin, e.g. `https://api.example.com` |
| `EMBEDDED_APP_URL` | Public web origin, e.g. `https://app.example.com` |
| `NEXT_PUBLIC_API_URL` | Same as API origin (browser) |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Same as `SHOPIFY_API_KEY` |
| `OPENAI_API_KEY` | Optional; AI reports degrade without it |
| `SHOPIFY_BILLING_TEST` | `true` until App Store live billing |

**Do not overwrite an existing `.env` that already has secrets.** Merge new keys from `.env.example` carefully.

## 3. Install, schema, build

```bash
cd /var/www/stockSentry
npm install
npm run db:generate
npm run db:push
npm run build
```

## 4. PM2

```bash
cd /var/www/stockSentry
pm2 start ecosystem.config.cjs
# later updates:
pm2 reload ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5. Nginx reverse proxy

### Option A — two hostnames (recommended)

```nginx
# /etc/nginx/sites-available/stocksentry-api
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Shopify webhooks need the raw body — do not buffer-transform it
        proxy_request_buffering on;
        client_max_body_size 2m;
    }
}

# /etc/nginx/sites-available/stocksentry-web
server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable TLS with certbot after DNS points at the droplet.

Set Partner app URLs / redirects to these hosts. Webhook URI: `https://api.example.com/webhooks/shopify`.

### Option B — single host with path routing

```nginx
# /etc/nginx/sites-available/stocksentry
server {
    listen 80;
    server_name stocksentry.example.com;

    # API + OAuth + webhooks
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhooks/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    # Next.js UI (everything else)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With path routing, set:

```bash
APP_URL=https://stocksentry.example.com
EMBEDDED_APP_URL=https://stocksentry.example.com
NEXT_PUBLIC_API_URL=https://stocksentry.example.com
```

And Partner redirect URLs to `https://stocksentry.example.com/auth/callback` (etc.).

## 6. Update cycle

```bash
cd /var/www/stockSentry
git pull origin main
npm install
npm run db:generate
npm run db:push    # or migrate in production once migrations are locked
npm run build
pm2 reload ecosystem.config.cjs
```

## 7. Smoke checks

```bash
curl -s https://api.example.com/health
pm2 status
pm2 logs stocksentry-api --lines 50
```

Open the app from Shopify Admin → Connect if prompted → run Products sync → confirm webhooks in Partner dashboard.
