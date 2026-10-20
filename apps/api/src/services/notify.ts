import {
  prisma,
  type DeliveryStatus,
  type IncidentSeverity,
} from "@stocksentry/database";

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

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
  if (SEVERITY_RANK[input.severity] < SEVERITY_RANK[minSeverity]) {
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

export async function listNotifications(
  shopId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
) {
  const limit = opts.limit ?? 50;
  return prisma.notificationDelivery.findMany({
    where: {
      shopId,
      channel: "IN_APP",
      ...(opts.unreadOnly ? { status: "SENT", sentAt: { not: null } } : {}),
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
            select: { productTitle: true, variantTitle: true, sku: true },
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
      // In-app "read" tracked via destination field when no dedicated column
      destination: "read",
    },
  });
}
