import { Router } from "express";
import { prisma, type Prisma } from "@stocksentry/database";
import {
  ENTITLEMENT_ERROR_CODES,
  getPlanEntitlements,
} from "@stocksentry/shared";
import { requireMerchant } from "../middleware/auth.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";

export const exportsRouter = Router();

exportsRouter.post("/exports", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    const plan = getPlanEntitlements(shop.planSlug);
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
    res.json({ items: jobs });
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
    res.json(job);
  } catch (err) {
    next(err);
  }
});
