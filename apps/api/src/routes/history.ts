import { Router } from "express";
import { prisma, type ObservationSource } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";

export const historyRouter = Router();

const PAGE_SIZE = 50;

historyRouter.get("/history", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const source = req.query.source as ObservationSource | undefined;
    const inventoryItemId =
      typeof req.query.inventoryItemId === "string"
        ? req.query.inventoryItemId
        : undefined;
    const locationId =
      typeof req.query.locationId === "string"
        ? req.query.locationId
        : undefined;
    const from =
      typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to =
      typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const where = {
      shopId,
      ...(source ? { source } : {}),
      ...(inventoryItemId ? { inventoryItemId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(from || to
        ? {
            observedAt: {
              ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
              ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.inventoryObservation.count({ where }),
      prisma.inventoryObservation.findMany({
        where,
        orderBy: { observedAt: "desc" },
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

historyRouter.get(
  "/history/export.csv",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const rows = await prisma.inventoryObservation.findMany({
        where: { shopId },
        orderBy: { observedAt: "desc" },
        take: 10000,
        include: {
          inventoryItem: {
            select: { productTitle: true, variantTitle: true, sku: true },
          },
          location: { select: { name: true } },
        },
      });

      const header = [
        "id",
        "observedAt",
        "source",
        "quantity",
        "quantityName",
        "dataQuality",
        "product",
        "variant",
        "sku",
        "location",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.id,
            r.observedAt.toISOString(),
            r.source,
            String(r.quantity),
            r.quantityName,
            r.dataQuality,
            csvEscape(r.inventoryItem.productTitle ?? ""),
            csvEscape(r.inventoryItem.variantTitle ?? ""),
            csvEscape(r.inventoryItem.sku ?? ""),
            csvEscape(r.location.name),
          ].join(","),
        );
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="observations.csv"',
      );
      res.send(lines.join("\n"));
    } catch (err) {
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
