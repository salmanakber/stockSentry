import {
  prisma,
  type DeliveryStatus,
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
 * Create an EMAIL delivery when pref enabled + destination email set.
 * Intended for NEW / HIGH+ incidents (caller filters severity).
 */
export async function createEmailNotification(input: {
  shopId: string;
  incidentId: string;
  severity: IncidentSeverity;
}): Promise<{ id: string; status: DeliveryStatus } | null> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      shopId_channel: { shopId: input.shopId, channel: "EMAIL" },
    },
  });

  if (!pref || !pref.enabled) {
    return null;
  }

  if (!meetsMinSeverity(input.severity, pref.minSeverity)) {
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

  const to = pref.destinationRef?.trim();
  if (!to || !to.includes("@")) {
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

  const payload = incident?.evidence?.[0]?.evidencePayload as
    | { delta?: number; previousQuantity?: number; quantity?: number }
    | null
    | undefined;
  const quantityDelta =
    payload?.delta != null
      ? String(payload.delta)
      : payload?.previousQuantity != null && payload?.quantity != null
        ? String(payload.quantity - payload.previousQuantity)
        : "—";

  const result = await sendTemplatedEmail({
    shopId: delivery.shopId,
    to,
    key: "INCIDENT_ALERT",
    vars: {
      shopName: delivery.shop.shopDomain,
      incidentTitle: incident
        ? `${incident.type} · ${incident.severity}`
        : "Incident alert",
      severity: incident?.severity ?? "UNKNOWN",
      productTitle,
      quantityDelta,
      incidentUrl: `${appBaseUrl()}/incidents/${incident?.id ?? ""}`,
      summary: incident
        ? `Rule ${incident.ruleType} flagged this change at ${incident.location?.name ?? "unknown location"}.`
        : "StockSentry incident notification.",
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
      quantityDelta: "—",
      incidentUrl: `${appBaseUrl()}/notifications`,
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
