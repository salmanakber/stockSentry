import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Side-effect import: must run before other app modules read process.env.
// From src/ or dist/, three levels up is the monorepo root.
const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
loadEnv({ path: path.join(rootDir, ".env") });
