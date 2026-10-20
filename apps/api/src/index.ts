import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

// Monorepo root `.env` (PM2 cwd is apps/api; default dotenv would miss it)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(rootDir, ".env") });


const port = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(port, () => {
  console.log(`[stocksentry-api] listening on :${port}`);
});
