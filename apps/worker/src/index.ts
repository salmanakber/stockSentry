import "dotenv/config";
import { createBoss, QUEUE_NAMES, registerJobs, stopBoss } from "./boss.js";

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
