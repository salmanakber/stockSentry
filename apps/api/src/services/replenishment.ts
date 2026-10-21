import { prisma, type ReplenishmentRequest } from "@stocksentry/database";
import {
  buildReplenishmentDedupeKey,
  canAutoSendReplenishmentEmail,
  isOpenReplenishmentStatus,
  isValidSupplierEmail,
  shouldTriggerReplenishment,
} from "@stocksentry/shared";
import { appBaseUrl, renderTemplate, resolveEmailTemplate, sendTemplatedEmail } from "./email.js";

const OPEN_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "QUEUED",
] as const;

function itemLabel(item?: {
  productTitle?: string | null;
  variantTitle?: string | null;
  sku?: string | null;
} | null): string {
  if (!item) return "Inventory item";
  const base = item.productTitle?.trim() || "Untitled";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return item.sku ? `${base} (${item.sku})` : base;
}

async function findActiveRuleConflict(input: {
  shopId: string;
  supplierId: string;
  inventoryItemId?: string | null;
  bundleGroupId?: string | null;
  excludeId?: string;
}): Promise<boolean> {
  const existing = await prisma.supplierReplenishmentRule.findFirst({
    where: {
      shopId: input.shopId,
      supplierId: input.supplierId,
      active: true,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      ...(input.inventoryItemId
        ? { inventoryItemId: input.inventoryItemId }
        : { bundleGroupId: input.bundleGroupId! }),
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function assertNoActiveRuleConflict(input: {
  shopId: string;
  supplierId: string;
  inventoryItemId?: string | null;
  bundleGroupId?: string | null;
  excludeId?: string;
}): Promise<void> {
  if (await findActiveRuleConflict(input)) {
    throw new Error("ACTIVE_RULE_EXISTS");
  }
}

async function notifyMerchantReplenishmentApproval(input: {
  shopId: string;
  requestId: string;
  productTitle: string;
}): Promise<void> {
  await prisma.notificationDelivery.create({
    data: {
      shopId: input.shopId,
      channel: "IN_APP",
      status: "SENT",
      sentAt: new Date(),
      destination: `replenishment:${input.requestId}`,
      errorCode: null,
    },
  });
}

export async function sendReplenishmentEmail(input: {
  shopId: string;
  shopDomain: string;
  request: ReplenishmentRequest;
  demoMode?: boolean;
}): Promise<{ ok: boolean; errorCode?: string; subject?: string; bodyPreview?: string }> {
  if (input.demoMode) {
    return { ok: false, errorCode: "DEMO_MODE" };
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.request.supplierId, shopId: input.shopId },
  });
  if (!supplier) {
    return { ok: false, errorCode: "SUPPLIER_NOT_FOUND" };
  }
  if (!supplier.verified) {
    return { ok: false, errorCode: "SUPPLIER_NOT_VERIFIED" };
  }

  const to = (input.request.supplierEmail ?? supplier.contactEmail ?? "").trim();
  if (!isValidSupplierEmail(to)) {
    return { ok: false, errorCode: "INVALID_SUPPLIER_EMAIL" };
  }

  const [item, group, rule] = await Promise.all([
    input.request.inventoryItemId
      ? prisma.inventoryItem.findFirst({
          where: { id: input.request.inventoryItemId, shopId: input.shopId },
          select: {
            id: true,
            productTitle: true,
            variantTitle: true,
            sku: true,
          },
        })
      : null,
    input.request.bundleGroupId
      ? prisma.bundleGroup.findFirst({
          where: { id: input.request.bundleGroupId, shopId: input.shopId },
          select: { id: true, name: true },
        })
      : null,
    prisma.supplierReplenishmentRule.findFirst({
      where: {
        shopId: input.shopId,
        supplierId: input.request.supplierId,
        active: true,
        ...(input.request.inventoryItemId
          ? { inventoryItemId: input.request.inventoryItemId }
          : input.request.bundleGroupId
            ? { bundleGroupId: input.request.bundleGroupId }
            : { id: "___none___" }),
      },
    }),
  ]);

  const productTitle = group?.name ?? itemLabel(item);
  const restockQuantity = rule?.restockQuantity ?? input.request.quantity;
  const vars = {
    shopName: input.shopDomain,
    supplierName: supplier.name,
    productTitle,
    currentQuantity: String(input.request.quantity),
    threshold: String(input.request.threshold),
    restockQuantity: String(restockQuantity),
    summary: `Observed quantity ${input.request.quantity} is at or below threshold ${input.request.threshold}. Please prepare a restock of ${restockQuantity}.`,
    disclaimer:
      "StockSentry is read-only and does not change Shopify inventory.",
    requestUrl: `${appBaseUrl()}/replenishment`,
  };

  const tpl = await resolveEmailTemplate(input.shopId, "SUPPLIER_REPLENISH");
  const subject = renderTemplate(tpl.subject, vars);
  const bodyPreview = renderTemplate(tpl.textBody, vars).slice(0, 500);

  const result = await sendTemplatedEmail({
    shopId: input.shopId,
    to,
    key: "SUPPLIER_REPLENISH",
    vars,
  });

  return {
    ok: result.ok,
    errorCode: result.errorCode,
    subject,
    bodyPreview,
  };
}

/**
 * Evaluate replenishment rules after an observation (low stock path).
 * Read-only toward Shopify — only creates requests / emails / in-app notify.
 */
export async function evaluateReplenishmentForObservation(input: {
  shopId: string;
  shopDomain?: string;
  inventoryItemId: string;
  quantity: number;
  demoMode?: boolean;
}): Promise<{ created: number; sent: number }> {
  let created = 0;
  let sent = 0;

  const shop =
    input.shopDomain != null
      ? { shopDomain: input.shopDomain }
      : await prisma.shop.findUnique({
          where: { id: input.shopId },
          select: { shopDomain: true },
        });
  if (!shop) return { created, sent };

  const memberships = await prisma.bundleGroupItem.findMany({
    where: {
      shopId: input.shopId,
      inventoryItemId: input.inventoryItemId,
      bundleGroup: { active: true },
    },
    select: { bundleGroupId: true },
  });
  const groupIds = memberships.map((m) => m.bundleGroupId);

  const rules = await prisma.supplierReplenishmentRule.findMany({
    where: {
      shopId: input.shopId,
      active: true,
      OR: [
        { inventoryItemId: input.inventoryItemId },
        ...(groupIds.length
          ? [{ bundleGroupId: { in: groupIds } }]
          : []),
      ],
    },
    include: {
      supplier: true,
    },
  });

  for (const rule of rules) {
    const openExists = await prisma.replenishmentRequest.findFirst({
      where: {
        shopId: input.shopId,
        supplierId: rule.supplierId,
        status: { in: [...OPEN_STATUSES] },
        ...(rule.inventoryItemId
          ? { inventoryItemId: rule.inventoryItemId }
          : { bundleGroupId: rule.bundleGroupId! }),
      },
      select: { id: true },
    });

    const decision = shouldTriggerReplenishment({
      quantity: input.quantity,
      lowStockThreshold: rule.lowStockThreshold,
      ruleActive: rule.active,
      lastTriggeredAt: rule.lastTriggeredAt,
      openRequestExists: Boolean(openExists),
    });
    if (!decision.trigger) continue;

    const dedupeKey = buildReplenishmentDedupeKey({
      shopId: input.shopId,
      supplierId: rule.supplierId,
      inventoryItemId: rule.inventoryItemId,
      bundleGroupId: rule.bundleGroupId,
    });

    const existing = await prisma.replenishmentRequest.findUnique({
      where: {
        shopId_dedupeKey: { shopId: input.shopId, dedupeKey },
      },
    });

    if (existing && isOpenReplenishmentStatus(existing.status)) {
      continue;
    }
    if (existing && existing.status === "SENT") {
      continue;
    }

    const autoSend = canAutoSendReplenishmentEmail({
      autoEmailEnabled: rule.autoEmailEnabled,
      requireApproval: rule.requireApproval,
      supplierVerified: rule.supplier.verified,
      supplierEmail: rule.supplier.contactEmail,
      demoMode: input.demoMode,
    });

    const initialStatus = autoSend
      ? "QUEUED"
      : rule.requireApproval || !rule.autoEmailEnabled
        ? "PENDING_APPROVAL"
        : "DRAFT";

    const requestData = {
      shopId: input.shopId,
      supplierId: rule.supplierId,
      inventoryItemId: rule.inventoryItemId,
      bundleGroupId: rule.bundleGroupId,
      status: initialStatus as
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "QUEUED"
        | "SENT"
        | "FAILED"
        | "CANCELLED",
      quantity: input.quantity,
      threshold: rule.lowStockThreshold,
      supplierEmail: rule.supplier.contactEmail,
      dedupeKey,
      errorCode: null as string | null,
      sentAt: null as Date | null,
      approvedAt: null as Date | null,
      subject: null as string | null,
      bodyPreview: null as string | null,
    };

    let request: ReplenishmentRequest;
    if (existing) {
      request = await prisma.replenishmentRequest.update({
        where: { id: existing.id },
        data: requestData,
      });
    } else {
      request = await prisma.replenishmentRequest.create({
        data: requestData,
      });
    }
    created += 1;

    await prisma.supplierReplenishmentRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() },
    });

    if (autoSend) {
      const sendResult = await sendReplenishmentEmail({
        shopId: input.shopId,
        shopDomain: shop.shopDomain,
        request,
        demoMode: input.demoMode,
      });
      if (sendResult.ok) {
        await prisma.replenishmentRequest.update({
          where: { id: request.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            approvedAt: new Date(),
            subject: sendResult.subject ?? null,
            bodyPreview: sendResult.bodyPreview ?? null,
            errorCode: null,
          },
        });
        sent += 1;
      } else {
        await prisma.replenishmentRequest.update({
          where: { id: request.id },
          data: {
            status: "FAILED",
            errorCode: sendResult.errorCode ?? "EMAIL_SEND_FAILED",
            subject: sendResult.subject ?? null,
            bodyPreview: sendResult.bodyPreview ?? null,
          },
        });
        await notifyMerchantReplenishmentApproval({
          shopId: input.shopId,
          requestId: request.id,
          productTitle: "Replenishment email failed — review in Replenishment",
        });
      }
    } else {
      await notifyMerchantReplenishmentApproval({
        shopId: input.shopId,
        requestId: request.id,
        productTitle: "Approve supplier replenishment email",
      });
    }
  }

  return { created, sent };
}

export async function approveReplenishmentRequest(input: {
  shopId: string;
  shopDomain: string;
  requestId: string;
  demoMode?: boolean;
}): Promise<ReplenishmentRequest> {
  if (input.demoMode) {
    throw new Error("DEMO_MODE");
  }

  const request = await prisma.replenishmentRequest.findFirst({
    where: { id: input.requestId, shopId: input.shopId },
  });
  if (!request) {
    throw new Error("NOT_FOUND");
  }
  if (request.status === "SENT") {
    return request;
  }
  if (request.status === "CANCELLED") {
    throw new Error("ALREADY_CANCELLED");
  }

  const sendResult = await sendReplenishmentEmail({
    shopId: input.shopId,
    shopDomain: input.shopDomain,
    request,
    demoMode: false,
  });

  if (!sendResult.ok) {
    return prisma.replenishmentRequest.update({
      where: { id: request.id },
      data: {
        status: "FAILED",
        errorCode: sendResult.errorCode ?? "EMAIL_SEND_FAILED",
        subject: sendResult.subject ?? null,
        bodyPreview: sendResult.bodyPreview ?? null,
      },
    });
  }

  return prisma.replenishmentRequest.update({
    where: { id: request.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      approvedAt: new Date(),
      subject: sendResult.subject ?? null,
      bodyPreview: sendResult.bodyPreview ?? null,
      errorCode: null,
    },
  });
}

export async function cancelReplenishmentRequest(input: {
  shopId: string;
  requestId: string;
}): Promise<ReplenishmentRequest> {
  const request = await prisma.replenishmentRequest.findFirst({
    where: { id: input.requestId, shopId: input.shopId },
  });
  if (!request) {
    throw new Error("NOT_FOUND");
  }
  if (request.status === "SENT") {
    throw new Error("ALREADY_SENT");
  }
  if (request.status === "CANCELLED") {
    return request;
  }
  return prisma.replenishmentRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED" },
  });
}
