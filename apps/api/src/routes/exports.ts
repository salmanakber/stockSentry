import { Router } from "express";
import { prisma, type Prisma } from "@stocksentry/database";
import { ENTITLEMENT_ERROR_CODES } from "@stocksentry/shared";
import { requireMerchant } from "../middleware/auth.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";
import { resolvePlan } from "../services/plans.js";

export const exportsRouter = Router();

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return lines.join("\n") + "\n";
}

exportsRouter.post("/exports", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    const plan = await resolvePlan(shop.planSlug);
    if (!plan.exportsEnabled) {
      res.status(403).json({
        error: "exports_not_enabled",
        code: ENTITLEMENT_ERROR_CODES.EXPORTS_NOT_ENABLED,
        message: "Upgrade your plan to enable CSV exports.",
      });
      return;
    }

    const exportType =
      typeof req.body?.exportType === "string"
        ? req.body.exportType
        : "incidents";
    const filterJson = (req.body?.filters ?? null) as Prisma.InputJsonValue;

    const job = await prisma.exportJob.create({
      data: {
        shopId,
        exportType,
        status: "QUEUED",
        filterJson,
      },
    });

    await enqueue(QUEUE_NAMES.EXPORT_CSV, {
      exportJobId: job.id,
      shopId,
    });

    res.status(202).json(job);
  } catch (err) {
    next(err);
  }
});

exportsRouter.get("/exports", requireMerchant, async (req, res, next) => {
  try {
    const jobs = await prisma.exportJob.findMany({
      where: { shopId: req.shopId! },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      items: jobs.map((j) => ({
        ...j,
        resultUrl:
          j.status === "COMPLETED"
            ? `/api/v1/exports/${j.id}/download`
            : j.resultUrl,
      })),
    });
  } catch (err) {
    next(err);
  }
});

exportsRouter.get("/exports/:id", requireMerchant, async (req, res, next) => {
  try {
    const job = await prisma.exportJob.findFirst({
      where: { id: req.params.id, shopId: req.shopId! },
    });
    if (!job) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      ...job,
      resultUrl:
        job.status === "COMPLETED"
          ? `/api/v1/exports/${job.id}/download`
          : job.resultUrl,
    });
  } catch (err) {
    next(err);
  }
});

exportsRouter.get(
  "/exports/:id/download",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const job = await prisma.exportJob.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!job) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (job.status !== "COMPLETED") {
        res.status(409).json({
          error: "not_ready",
          status: job.status,
          message: "Export is not completed yet.",
        });
        return;
      }

      const exportType = job.exportType;
      let csv: string;
      let filename: string;

      if (exportType === "observations" || exportType === "history") {
        const rows = await prisma.inventoryObservation.findMany({
          where: { shopId },
          orderBy: { observedAt: "desc" },
          take: 10_000,
          include: {
            inventoryItem: {
              select: { productTitle: true, variantTitle: true, sku: true, imageUrl: true },
            },
            location: { select: { name: true } },
          },
        });
        csv = toCsv(
          [
            "observedAt",
            "productTitle",
            "variantTitle",
            "sku",
            "location",
            "quantity",
            "source",
            "dataQuality",
          ],
          rows.map((r) => [
            r.observedAt.toISOString(),
            r.inventoryItem.productTitle,
            r.inventoryItem.variantTitle,
            r.inventoryItem.sku,
            r.location.name,
            r.quantity,
            r.source,
            r.dataQuality,
          ]),
        );
        filename = `stocksentry-${exportType}-${job.id}.csv`;
      } else {
        const rows = await prisma.incident.findMany({
          where: { shopId },
          orderBy: { lastDetectedAt: "desc" },
          take: 10_000,
          include: {
            inventoryItem: {
              select: { productTitle: true, variantTitle: true, sku: true, imageUrl: true },
            },
            location: { select: { name: true } },
          },
        });
        csv = toCsv(
          [
            "id",
            "type",
            "severity",
            "status",
            "ruleType",
            "productTitle",
            "variantTitle",
            "sku",
            "location",
            "firstDetectedAt",
            "lastDetectedAt",
          ],
          rows.map((r) => [
            r.id,
            r.type,
            r.severity,
            r.status,
            r.ruleType,
            r.inventoryItem?.productTitle,
            r.inventoryItem?.variantTitle,
            r.inventoryItem?.sku,
            r.location?.name,
            r.firstDetectedAt.toISOString(),
            r.lastDetectedAt.toISOString(),
          ]),
        );
        filename = `stocksentry-incidents-${job.id}.csv`;
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);
