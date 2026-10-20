const fs = require("fs");
const path = require("path");

/**
 * PM2 has no native env_file. Load monorepo-root `.env` into each process env.
 * apps/api and apps/worker also call dotenv with an explicit root path.
 * Next.js only auto-reads apps/web/.env* — this merges root vars for `next start`.
 */
function loadRootEnv() {
  const envPath = path.join(__dirname, ".env");
  const out = {};
  if (!fs.existsSync(envPath)) return out;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const rootEnv = loadRootEnv();

/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: "stocksentry-api",
      cwd: "./apps/api",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        ...rootEnv,
        NODE_ENV: "production",
        PORT: rootEnv.PORT || 4000,
      },
    },
    {
      name: "stocksentry-web",
      cwd: "./apps/web",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        ...rootEnv,
        NODE_ENV: "production",
        PORT: rootEnv.WEB_PORT || rootEnv.PORT_WEB || 6080,
      },
    },
    {
      name: "stocksentry-admin",
      cwd: "./apps/admin",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        ...rootEnv,
        NODE_ENV: "production",
        PORT: rootEnv.ADMIN_PORT || 6082,
      },
    },
    {
      name: "stocksentry-worker",
      cwd: "./apps/worker",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        ...rootEnv,
        NODE_ENV: "production",
      },
    },
  ],
};
