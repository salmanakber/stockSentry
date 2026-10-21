import PgBoss from "pg-boss";

export const QUEUE_NAMES = {
  WEBHOOK_PROCESS: "webhook.process",
  INVENTORY_BASELINE: "inventory.baseline",
  INVENTORY_RECONCILE: "inventory.reconcile",
  DETECTION_EVALUATE: "detection.evaluate",
  AI_REPORT: "ai.report",
  PRODUCT_REPORT: "product.report",
  NOTIFY_DELIVER: "notify.deliver",
  EXPORT_CSV: "export.csv",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is required for job queues");
      }
      const boss = new PgBoss({
        connectionString,
        application_name: "stocksentry-api",
      });
      boss.on("error", (err: Error) => {
        console.error("[pg-boss:api] error", err);
      });
      await boss.start();
      for (const name of Object.values(QUEUE_NAMES)) {
        await boss.createQueue(name);
      }
      return boss;
    })();
  }
  return bossPromise;
}

export async function enqueue<T extends object>(
  name: QueueName,
  data: T,
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(name, data, options ?? {});
}

export type WebhookProcessJob = {
  webhookEventId: string;
  shopId: string;
  shopDomain: string;
  topic: string;
  payload: unknown;
};

export type InventoryBaselineJob = {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
};

export type InventoryReconcileJob = {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
};

export type DetectionEvaluateJob = {
  shopId: string;
  inventoryItemId: string;
  locationId: string;
  observationId: string;
  quantity: number;
  previousQuantity: number | null;
  observedAt: string;
  source: string;
};

export type AiReportJob = {
  reportId: string;
  shopId: string;
  incidentId: string;
};

export type ProductReportJob = {
  reportId: string;
  shopId: string;
  inventoryItemId: string;
};

export type NotifyDeliverJob = {
  deliveryId: string;
  shopId: string;
};

export type ExportCsvJob = {
  exportJobId: string;
  shopId: string;
};
