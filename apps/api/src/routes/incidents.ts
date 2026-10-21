import { Router } from "express";
import { prisma, type IncidentStatus, type IncidentSeverity } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import { enqueueAiReport } from "../services/ai-report.js";
import { EntitlementError } from "../services/billing.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";

export const incidentsRouter = Router();

const PAGE_SIZE = 25;

incidentsRouter.get("/incidents", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const status = req.query.status as IncidentStatus | undefined;
    const severity = req.query.severity as IncidentSeverity | undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const productId =
      typeof req.query.productId === "string" ? req.query.productId.trim() : "";
    const page = Math.max(1, Number(req.query.page) || 1);

    const where = {
      shopId,
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(productId ? { inventoryItemId: productId } : {}),
      ...(q
        ? {
            OR: [
              { type: { contains: q, mode: "insensitive" as const } },
              { ruleType: { contains: q, mode: "insensitive" as const } },
              {
                inventoryItem: {
                  OR: [
                    { productTitle: { contains: q, mode: "insensitive" as const } },
                    { sku: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        orderBy: { lastDetectedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
          location: { select: { id: true, name: true } },
          aiReports: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, generatedAt: true },
          },
        },
      }),
    ]);

    res.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get(
  "/incidents/export.csv",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const incidents = await prisma.incident.findMany({
        where: { shopId },
        orderBy: { lastDetectedAt: "desc" },
        take: 5000,
        include: {
          inventoryItem: {
            select: { productTitle: true, variantTitle: true, sku: true },
          },
          location: { select: { name: true } },
        },
      });

      const header = [
        "id",
        "type",
        "severity",
        "status",
        "ruleType",
        "product",
        "variant",
        "sku",
        "location",
        "firstDetectedAt",
        "lastDetectedAt",
      ];
      const lines = [header.join(",")];
      for (const i of incidents) {
        const row = [
          i.id,
          i.type,
          i.severity,
          i.status,
          i.ruleType,
          csvEscape(i.inventoryItem?.productTitle ?? ""),
          csvEscape(i.inventoryItem?.variantTitle ?? ""),
          csvEscape(i.inventoryItem?.sku ?? ""),
          csvEscape(i.location?.name ?? ""),
          i.firstDetectedAt.toISOString(),
          i.lastDetectedAt.toISOString(),
        ];
        lines.push(row.join(","));
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="incidents.csv"',
      );
      res.send(lines.join("\n"));
    } catch (err) {
      next(err);
    }
  },
);

incidentsRouter.get(
  "/incidents/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const incident = await prisma.incident.findFirst({
        where: { id: req.params.id, shopId },
        include: {
          inventoryItem: true,
          location: true,
          evidence: { orderBy: { createdAt: "asc" } },
          notes: { orderBy: { createdAt: "desc" } },
          activities: { orderBy: { createdAt: "desc" } },
          aiReports: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      if (!incident) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(incident);
    } catch (err) {
      next(err);
    }
  },
);

incidentsRouter.patch(
  "/incidents/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.incident.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as {
        status?: IncidentStatus;
        notes?: string;
        resolutionReason?: string;
      };

      const statusChanged =
        body.status && body.status !== existing.status
          ? body.status
          : undefined;

      const incident = await prisma.incident.update({
        where: { id: existing.id },
        data: {
          ...(statusChanged
            ? {
                status: statusChanged,
                resolvedAt:
                  statusChanged === "RESOLVED" || statusChanged === "DISMISSED"
                    ? new Date()
                    : null,
                resolutionReason: body.resolutionReason ?? undefined,
              }
            : {}),
        },
      });

      if (statusChanged) {
        await prisma.incidentActivity.create({
          data: {
            shopId,
            incidentId: incident.id,
            actorType: "MERCHANT",
            activityType: "STATUS_CHANGE",
            content: `Status changed to ${statusChanged}`,
            metadata: { from: existing.status, to: statusChanged },
          },
        });
      }

      if (typeof body.notes === "string" && body.notes.trim()) {
        await prisma.incidentNote.create({
          data: {
            shopId,
            incidentId: incident.id,
            actorType: "MERCHANT",
            content: body.notes.trim(),
          },
        });
      }

      res.json(incident);
    } catch (err) {
      next(err);
    }
  },
);

incidentsRouter.post(
  "/incidents/:id/notes",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.incident.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        res.status(400).json({ error: "content_required" });
        return;
      }

      const note = await prisma.incidentNote.create({
        data: {
          shopId,
          incidentId: existing.id,
          actorType: "MERCHANT",
          content,
        },
      });

      await prisma.incidentActivity.create({
        data: {
          shopId,
          incidentId: existing.id,
          actorType: "MERCHANT",
          activityType: "NOTE_ADDED",
          content: "Note added",
        },
      });

      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  },
);

incidentsRouter.post(
  "/incidents/:id/ai-report",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.incident.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const report = await enqueueAiReport({
        shopId,
        incidentId: existing.id,
      });

      await enqueue(QUEUE_NAMES.AI_REPORT, {
        reportId: report.id,
        shopId,
        incidentId: existing.id,
      });

      res.status(202).json(report);
    } catch (err) {
      if (err instanceof EntitlementError) {
        res.status(429).json({
          error: "ai_quota_exceeded",
          code: err.code,
          message: err.message,
        });
        return;
      }
      if (err instanceof Error && err.message === "AI_QUOTA_EXCEEDED") {
        res.status(429).json({
          error: "ai_quota_exceeded",
          code: "ENTITLEMENT_AI_QUOTA_EXCEEDED",
        });
        return;
      }
      next(err);
    }
  },
);

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
