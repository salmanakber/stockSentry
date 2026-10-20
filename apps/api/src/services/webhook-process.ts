import { createHash } from "node:crypto";
import { prisma, shopRepository } from "@stocksentry/database";
import { createObservation } from "./observation.js";
import {
  handleCustomerDataRequest,
  handleCustomerRedact,
  handleShopRedact,
  handleUninstall,
} from "./compliance.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().replace(/_/g, "/");
}

function inventoryItemGidFromPayload(payload: Record<string, unknown>): string | null {
  const inventoryItemId = payload.inventory_item_id;
  if (typeof inventoryItemId === "number" || typeof inventoryItemId === "string") {
    return `gid://shopify/InventoryItem/${inventoryItemId}`;
  }
  if (typeof payload.admin_graphql_api_id === "string" &&
      payload.admin_graphql_api_id.includes("InventoryLevel")) {
    // inventory_levels/update may not include item gid directly
  }
  return null;
}

function locationGidFromPayload(payload: Record<string, unknown>): string | null {
  const locationId = payload.location_id;
  if (typeof locationId === "number" || typeof locationId === "string") {
    return `gid://shopify/Location/${locationId}`;
  }
  return null;
}

async function processInventoryLevelUpdate(input: {
  shopId: string;
  shopDomain: string;
  eventId: string;
  payload: Record<string, unknown>;
}) {
  const itemGid = inventoryItemGidFromPayload(input.payload);
  const locationGid = locationGidFromPayload(input.payload);
  const available =
    typeof input.payload.available === "number"
      ? input.payload.available
      : null;

  if (!itemGid || !locationGid || available === null) {
    return;
  }

  let item = await prisma.inventoryItem.findUnique({
    where: {
      shopId_shopifyInventoryItemGid: {
        shopId: input.shopId,
        shopifyInventoryItemGid: itemGid,
      },
    },
  });

  if (!item) {
    item = await prisma.inventoryItem.create({
      data: {
        shopId: input.shopId,
        shopifyInventoryItemGid: itemGid,
        tracked: true,
      },
    });
  }

  let location = await prisma.inventoryLocation.findUnique({
    where: {
      shopId_shopifyLocationGid: {
        shopId: input.shopId,
        shopifyLocationGid: locationGid,
      },
    },
  });

  if (!location) {
    location = await prisma.inventoryLocation.create({
      data: {
        shopId: input.shopId,
        shopifyLocationGid: locationGid,
        name: `Location ${locationGid.split("/").pop() ?? ""}`,
        active: true,
      },
    });
  }

  const observedAt = input.payload.updated_at
    ? new Date(String(input.payload.updated_at))
    : new Date();

  const { observation, previousQuantity } = await createObservation({
    shopId: input.shopId,
    inventoryItemId: item.id,
    locationId: location.id,
    quantity: available,
    observedAt: Number.isNaN(observedAt.getTime()) ? new Date() : observedAt,
    source: "WEBHOOK",
    sourceEventId: input.eventId,
  });

  await enqueue(QUEUE_NAMES.DETECTION_EVALUATE, {
    shopId: input.shopId,
    inventoryItemId: item.id,
    locationId: location.id,
    observationId: observation.id,
    quantity: available,
    previousQuantity,
    observedAt: observation.observedAt.toISOString(),
    source: "WEBHOOK",
  });
}

async function processProductUpdate(input: {
  shopId: string;
  payload: Record<string, unknown>;
}) {
  const productGid =
    typeof input.payload.admin_graphql_api_id === "string"
      ? input.payload.admin_graphql_api_id
      : typeof input.payload.id === "number" || typeof input.payload.id === "string"
        ? `gid://shopify/Product/${input.payload.id}`
        : null;
  if (!productGid) return;

  const title =
    typeof input.payload.title === "string" ? input.payload.title : undefined;

  await prisma.inventoryItem.updateMany({
    where: { shopId: input.shopId, productGid },
    data: {
      ...(title ? { productTitle: title } : {}),
      deletedAt: null,
    },
  });
}

async function processProductDelete(input: {
  shopId: string;
  payload: Record<string, unknown>;
}) {
  const productGid =
    typeof input.payload.admin_graphql_api_id === "string"
      ? input.payload.admin_graphql_api_id
      : typeof input.payload.id === "number" || typeof input.payload.id === "string"
        ? `gid://shopify/Product/${input.payload.id}`
        : null;
  if (!productGid) return;

  await prisma.inventoryItem.updateMany({
    where: { shopId: input.shopId, productGid },
    data: { deletedAt: new Date() },
  });
}

export async function processWebhookEvent(input: {
  webhookEventId: string;
  shopId: string;
  shopDomain: string;
  topic: string;
  payload: unknown;
}): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: input.webhookEventId },
  });
  if (!event) return;

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
    },
  });

  try {
    const topic = normalizeTopic(input.topic);
    const payload =
      input.payload && typeof input.payload === "object"
        ? (input.payload as Record<string, unknown>)
        : {};

    switch (topic) {
      case "inventory_levels/update":
      case "inventory_levels/connect":
        await processInventoryLevelUpdate({
          shopId: input.shopId,
          shopDomain: input.shopDomain,
          eventId: event.id,
          payload,
        });
        break;
      case "inventory_levels/disconnect":
        // Location disconnected from item — no quantity write
        break;
      case "products/update":
        await processProductUpdate({ shopId: input.shopId, payload });
        break;
      case "products/delete":
        await processProductDelete({ shopId: input.shopId, payload });
        break;
      case "app/uninstalled":
        await handleUninstall(input.shopDomain);
        break;
      case "customers/data_request":
        await handleCustomerDataRequest(payload);
        break;
      case "customers/redact":
        await handleCustomerRedact(payload);
        break;
      case "shop/redact":
        await handleShopRedact(input.shopDomain);
        break;
      default:
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        errorCode: null,
      },
    });

    await shopRepository.touchWebhook(input.shopId).catch(() => undefined);
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        errorCode:
          err instanceof Error ? err.message.slice(0, 64) : "process_failed",
      },
    });
    throw err;
  }
}

export function buildWebhookEventKey(input: {
  topic: string;
  shopDomain: string;
  webhookId?: string | null;
  rawBody: string;
}): string {
  if (input.webhookId) {
    return `${input.shopDomain}:${input.topic}:${input.webhookId}`;
  }
  const hash = createHash("sha256").update(input.rawBody).digest("hex").slice(0, 32);
  return `${input.shopDomain}:${input.topic}:${hash}`;
}
