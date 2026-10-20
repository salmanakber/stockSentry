import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBoss, QUEUE_NAMES, registerJobs, stopBoss } from "./boss.js";

// Monorepo root `.env` (PM2 cwd is apps/worker; default dotenv would miss it)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(rootDir, ".env") });


async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the worker");
  }

  const boss = await createBoss(connectionString);
  await registerJobs(boss);

  console.log(
    `[stocksentry-worker] started; queues: ${Object.values(QUEUE_NAMES).join(", ")}`,
  );

  const shutdown = async (signal: string) => {
    console.log(`[stocksentry-worker] received ${signal}, shutting down`);
    await stopBoss(boss);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[stocksentry-worker] fatal", err);
  process.exit(1);
});
