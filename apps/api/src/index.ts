import "./load-env.js";
import { createApp } from "./app.js";
import {
  ensureDefaultPlans,
  registerDbPlanLoader,
} from "./services/plans.js";

const port = Number(process.env.PORT ?? 4000);

registerDbPlanLoader();

const app = createApp();

void ensureDefaultPlans().catch((err) => {
  console.warn("[stocksentry-api] ensureDefaultPlans failed", err);
});

app.listen(port, () => {
  console.log(`[stocksentry-api] listening on :${port}`);
});
