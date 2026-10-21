import {
  prisma,
  type DeliveryStatus,
  type EmailTemplateKey,
  type IncidentSeverity,
} from "@stocksentry/database";
import { appBaseUrl, sendTemplatedEmail } from "./email.js";

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function meetsMinSeverity(
  severity: IncidentSeverity,
  minSeverity: IncidentSeverity,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minSeverity];
}

export function isHighOrCritical(severity: IncidentSeverity): boolean {
  return severity === "HIGH" || severity === "CRITICAL";
}

export function isMediumOrAbove(severity: IncidentSeverity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK.MEDIUM;
}

export async function createInAppNotification(input: {
  shopId: string;
  incidentId: string;
  severity: IncidentSeverity;
}): Promise<{ id: string; status: DeliveryStatus } | null> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      shopId_channel: { shopId: input.shopId, channel: "IN_APP" },
    },
  });

  if (pref && !pref.enabled) {
    return prisma.notificationDelivery.create({
      data: {
        shopId: input.shopId,
        incidentId: input.incidentId,
        channel: "IN_APP",
        status: "SUPPRESSED",
        errorCode: "channel_disabled",
      },
      select: { id: true, status: true },
    });
  }

  const minSeverity = pref?.minSeverity ?? "MEDIUM";
  if (!meetsMinSeverity(input.severity, minSeverity)) {
    return prisma.notificationDelivery.create({
      data: {
        shopId: input.shopId,
        incidentId: input.incidentId,
        channel: "IN_APP",
        status: "SUPPRESSED",
        errorCode: "below_min_severity",
      },
      select: { id: true, status: true },
    });
  }

  return prisma.notificationDelivery.create({
    data: {
      shopId: input.shopId,
      incidentId: input.incidentId,
      channel: "IN_APP",
      status: "PENDING",
    },
    select: { id: true, status: true },
  });
}

/**
 * Create an EMAIL delivery.
 * - Default: pref enabled + min severity + destination.
 * - forceIfDestination: HIGH/CRITICAL — attempt when destination is set even if channel disabled.
 */
export async function createEmailNotification(input: {
  shopId: string;
  incidentId: string;
  severity: IncidentSeverity;
  forceIfDestination?: boolean;
}): Promise<{ id: string; status: DeliveryStatus } | null> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      shopId_channel: { shopId: input.shopId, channel: "EMAIL" },
    },
  });

  const to = pref?.destinationRef?.trim() ?? "";
  const hasDestination = Boolean(to && to.includes("@"));

  if (!pref) {
    return null;
  }

  if (!pref.enabled && !(input.forceIfDestination && hasDestination)) {
    return null;
  }

  if (!meetsMinSeverity(input.severity, pref.minSeverity ?? "MEDIUM")) {
    // HIGH/CRITICAL force still respects min severity only when not forcing;
    // when forcing, skip min-severity gate if destination exists.
    if (!(input.forceIfDestination && hasDestination)) {
      return prisma.notificationDelivery.create({
        data: {
          shopId: input.shopId,
          incidentId: input.incidentId,
          channel: "EMAIL",
          destination: pref.destinationRef,
          status: "SUPPRESSED",
          errorCode: "below_min_severity",
        },
        select: { id: true, status: true },
      });
    }
  }

  if (!hasDestination) {
    return prisma.notificationDelivery.create({
      data: {
        shopId: input.shopId,
        incidentId: input.incidentId,
        channel: "EMAIL",
        destination: pref.destinationRef,
        status: "FAILED",
        errorCode: "NO_EMAIL_DESTINATION",
      },
      select: { id: true, status: true },
    });
  }

  return prisma.notificationDelivery.create({
    data: {
      shopId: input.shopId,
      incidentId: input.incidentId,
      channel: "EMAIL",
      destination: to,
      status: "PENDING",
    },
    select: { id: true, status: true },
  });
}

export async function deliverInAppNotification(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!delivery) return null;
  if (delivery.status === "SENT" || delivery.status === "SUPPRESSED") {
    return delivery;
  }

  return prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
}

function extractQtyFields(payload: unknown): {
  previousQuantity: string;
  currentQuantity: string;
  quantityDelta: string;
  whyFlagged: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  const prev =
    p.previousQuantity != null
      ? String(p.previousQuantity)
      : p.expectedFromLastObservation != null
        ? String(p.expectedFromLastObservation)
        : "—";
  const curr =
    p.currentQuantity != null
      ? String(p.currentQuantity)
      : p.shopifyQuantity != null
        ? String(p.shopifyQuantity)
        : p.quantity != null
          ? String(p.quantity)
          : "—";
  let delta = "—";
  if (p.absoluteDelta != null) delta = String(p.absoluteDelta);
  else if (p.delta != null) delta = String(p.delta);
  else if (
    typeof p.previousQuantity === "number" &&
    typeof p.currentQuantity === "number"
  ) {
    delta = String(p.currentQuantity - p.previousQuantity);
  }

  const whyParts: string[] = [];
  if (p.threshold != null) whyParts.push(`threshold ${p.threshold}`);
  if (p.percentThreshold != null)
    whyParts.push(`percent threshold ${p.percentThreshold}%`);
  if (p.refillThreshold != null)
    whyParts.push(`refill threshold ${p.refillThreshold}`);
  if (p.changeCount != null) whyParts.push(`${p.changeCount} changes in window`);
  if (p.openIncidentsOnComponent != null)
    whyParts.push(`${p.openIncidentsOnComponent} open component incidents`);

  return {
    previousQuantity: prev,
    currentQuantity: curr,
    quantityDelta: delta,
    whyFlagged: whyParts.length
      ? `Flagged because observed evidence met: ${whyParts.join(", ")}.`
      : "Flagged by a StockSentry detection rule based on observed quantity evidence.",
  };
}

export async function deliverEmailNotification(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      incident: {
        include: {
          inventoryItem: true,
          location: true,
          evidence: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      shop: { select: { shopDomain: true } },
    },
  });
  if (!delivery) return null;
  if (delivery.channel !== "EMAIL") return delivery;
  if (delivery.status === "SENT" || delivery.status === "SUPPRESSED") {
    return delivery;
  }

  const to = delivery.destination?.trim();
  if (!to || !to.includes("@")) {
    return prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorCode: "NO_EMAIL_DESTINATION",
        attemptCount: { increment: 1 },
      },
    });
  }

  const incident = delivery.incident;
  const item = incident?.inventoryItem;
  const productTitle = item
    ? [item.productTitle, item.variantTitle !== "Default Title" ? item.variantTitle : null]
        .filter(Boolean)
        .join(" · ") || "Unknown product"
    : "Unknown product";

  const qty = extractQtyFields(incident?.evidence?.[0]?.evidencePayload);
  const locationName = incident?.location?.name ?? "unknown location";
  const isRefill =
    incident?.type === "REFILL_RISK" || incident?.ruleType === "REFILL_RISK";
  const templateKey: EmailTemplateKey = isRefill
    ? "REFILL_ALERT"
    : "INCIDENT_ALERT";

  const summary = isRefill
    ? `Observed quantity at ${locationName} may need a refill. StockSentry suggests review only — it will not change inventory.`
    : `Unusual inventory change detected at ${locationName} (rule ${incident?.ruleType ?? "unknown"}). Confirmed facts are limited to observed quantities; possible causes are not confirmed.`;

  const result = await sendTemplatedEmail({
    shopId: delivery.shopId,
    to,
    key: templateKey,
    vars: {
      shopName: delivery.shop.shopDomain,
      incidentTitle: incident
        ? `${incident.type} · ${incident.severity}`
        : "Incident alert",
      severity: incident?.severity ?? "UNKNOWN",
      productTitle,
      locationName,
      previousQuantity: qty.previousQuantity,
      currentQuantity: qty.currentQuantity,
      quantityDelta: qty.quantityDelta,
      quantityBeforeAfter:
        qty.previousQuantity !== "—" || qty.currentQuantity !== "—"
          ? `${qty.previousQuantity} → ${qty.currentQuantity}`
          : qty.quantityDelta,
      whyFlagged: qty.whyFlagged,
      confirmedNote:
        "Confirmed: observed quantities and detection thresholds only. Possibilities (sales, transfers, adjustments) are not verified causes.",
      disclaimer:
        "StockSentry is read-only and does not change Shopify inventory.",
      incidentUrl: `${appBaseUrl()}/incidents/${incident?.id ?? ""}`,
      productUrl: item
        ? `${appBaseUrl()}/products/${item.id}`
        : `${appBaseUrl()}/products`,
      summary,
    },
  });

  if (!result.ok) {
    return prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorCode: result.errorCode ?? "EMAIL_SEND_FAILED",
        attemptCount: { increment: 1 },
      },
    });
  }

  return prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      errorCode: null,
      attemptCount: { increment: 1 },
    },
  });
}

export async function deliverNotification(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!delivery) return null;
  if (delivery.channel === "EMAIL") {
    return deliverEmailNotification(deliveryId);
  }
  return deliverInAppNotification(deliveryId);
}

export async function listNotifications(
  shopId: string,
  opts: { unreadOnly?: boolean; limit?: number; channel?: string } = {},
) {
  const limit = opts.limit ?? 50;
  const channelFilter =
    opts.channel === "EMAIL" || opts.channel === "IN_APP"
      ? { channel: opts.channel as "EMAIL" | "IN_APP" }
      : {};

  return prisma.notificationDelivery.findMany({
    where: {
      shopId,
      ...channelFilter,
      ...(opts.unreadOnly
        ? { channel: "IN_APP", status: "SENT", destination: { not: "read" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      incident: {
        select: {
          id: true,
          type: true,
          severity: true,
          status: true,
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
        },
      },
    },
  });
}

export async function markNotificationsRead(
  shopId: string,
  ids?: string[],
) {
  return prisma.notificationDelivery.updateMany({
    where: {
      shopId,
      channel: "IN_APP",
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: {
      destination: "read",
    },
  });
}

export async function enqueueTestEmail(input: {
  shopId: string;
  shopDomain: string;
  to?: string;
}): Promise<{ deliveryId: string; to: string }> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      shopId_channel: { shopId: input.shopId, channel: "EMAIL" },
    },
  });
  const to = (input.to ?? pref?.destinationRef ?? "").trim();
  if (!to || !to.includes("@")) {
    throw new Error("NO_EMAIL_DESTINATION");
  }

  const delivery = await prisma.notificationDelivery.create({
    data: {
      shopId: input.shopId,
      channel: "EMAIL",
      destination: to,
      status: "PENDING",
    },
  });

  const result = await sendTemplatedEmail({
    shopId: input.shopId,
    to,
    key: "TEST",
    vars: {
      shopName: input.shopDomain,
      summary: "StockSentry test email",
      incidentTitle: "Test",
      severity: "INFO",
      productTitle: "—",
      locationName: "—",
      previousQuantity: "—",
      currentQuantity: "—",
      quantityDelta: "—",
      quantityBeforeAfter: "—",
      whyFlagged: "This is a delivery test.",
      confirmedNote: "No inventory facts were evaluated.",
      disclaimer:
        "StockSentry is read-only and does not change Shopify inventory.",
      incidentUrl: `${appBaseUrl()}/notifications`,
      productUrl: `${appBaseUrl()}/products`,
    },
  });

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: result.ok
      ? {
          status: "SENT",
          sentAt: new Date(),
          attemptCount: 1,
          errorCode: null,
        }
      : {
          status: "FAILED",
          attemptCount: 1,
          errorCode: result.errorCode ?? "EMAIL_SEND_FAILED",
        },
  });

  return { deliveryId: delivery.id, to };
}
