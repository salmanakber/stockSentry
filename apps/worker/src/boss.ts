import PgBoss from "pg-boss";
import { processWebhookEvent } from "../../api/src/services/webhook-process.js";
import { runBaselineImport } from "../../api/src/services/inventory-import.js";
import { runReconcile } from "../../api/src/services/reconcile.js";
import { evaluateObservation } from "../../api/src/services/detection.js";
import { generateAiReport } from "../../api/src/services/ai-report.js";
import { deliverInAppNotification } from "../../api/src/services/notify.js";
import { prisma } from "@stocksentry/database";

export const QUEUE_NAMES = {
  WEBHOOK_PROCESS: "webhook.process",
  INVENTORY_BASELINE: "inventory.baseline",
  INVENTORY_RECONCILE: "inventory.reconcile",
  DETECTION_EVALUATE: "detection.evaluate",
  AI_REPORT: "ai.report",
  NOTIFY_DELIVER: "notify.deliver",
  EXPORT_CSV: "export.csv",
} as const;

/** @deprecated use QUEUE_NAMES */
export const JOB_NAMES = QUEUE_NAMES;

export async function createBoss(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    application_name: "stocksentry-worker",
  });

  boss.on("error", (err: Error) => {
    console.error("[pg-boss] error", err);
  });

  await boss.start();
  return boss;
}

export async function registerJobs(boss: PgBoss): Promise<void> {
  for (const name of Object.values(QUEUE_NAMES)) {
    await boss.createQueue(name);
  }

  await boss.work(QUEUE_NAMES.WEBHOOK_PROCESS, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as {
        webhookEventId: string;
        shopId: string;
        shopDomain: string;
        topic: string;
        payload: unknown;
      };
      await processWebhookEvent(data);
    }
  });

  await boss.work(QUEUE_NAMES.INVENTORY_BASELINE, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as {
        shopId: string;
        shopDomain: string;
        sessionToken?: string;
      };
      const result = await runBaselineImport(data);
      console.log(`[worker] inventory.baseline`, job.id, result);
    }
  });

  await boss.work(QUEUE_NAMES.INVENTORY_RECONCILE, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as {
        shopId: string;
        shopDomain: string;
        sessionToken?: string;
      };
      const result = await runReconcile(data);
      console.log(`[worker] inventory.reconcile`, job.id, result);
    }
  });

  await boss.work(QUEUE_NAMES.DETECTION_EVALUATE, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as {
        shopId: string;
        inventoryItemId: string;
        locationId: string;
        observationId: string;
        quantity: number;
        previousQuantity: number | null;
        observedAt: string;
        source: string;
      };
      const touched = await evaluateObservation({
        shopId: data.shopId,
        inventoryItemId: data.inventoryItemId,
        locationId: data.locationId,
        observationId: data.observationId,
        quantity: data.quantity,
        previousQuantity: data.previousQuantity,
        observedAt: new Date(data.observedAt),
        source: data.source,
      });
      console.log(
        `[worker] detection.evaluate`,
        job.id,
        `touched=${touched.length}`,
      );
    }
  });

  await boss.work(QUEUE_NAMES.AI_REPORT, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { reportId: string };
      const report = await generateAiReport(data.reportId);
      console.log(`[worker] ai.report`, job.id, report.status);
    }
  });

  await boss.work(QUEUE_NAMES.NOTIFY_DELIVER, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { deliveryId: string };
      await deliverInAppNotification(data.deliveryId);
      console.log(`[worker] notify.deliver`, job.id, data.deliveryId);
    }
  });

  await boss.work(QUEUE_NAMES.EXPORT_CSV, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { exportJobId: string; shopId: string };
      await runExportJob(data.exportJobId, data.shopId);
      console.log(`[worker] export.csv`, job.id, data.exportJobId);
    }
  });
}

async function runExportJob(exportJobId: string, shopId: string) {
  const job = await prisma.exportJob.findFirst({
    where: { id: exportJobId, shopId },
  });
  if (!job) return;

  await prisma.exportJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const exportType = job.exportType;
    let rowCount = 0;

    if (exportType === "observations" || exportType === "history") {
      rowCount = await prisma.inventoryObservation.count({ where: { shopId } });
    } else {
      rowCount = await prisma.incident.count({ where: { shopId } });
    }

    // MVP: mark completed with a synthetic result URL (no object storage yet)
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultUrl: `inline://${exportType}?rows=${rowCount}`,
        errorCode: null,
      },
    });
  } catch (err) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorCode:
          err instanceof Error ? err.message.slice(0, 64) : "export_failed",
      },
    });
    throw err;
  }
}

export async function stopBoss(boss: PgBoss): Promise<void> {
  await boss.stop({ graceful: true, timeout: 15_000 });
}
