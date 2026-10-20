import { prisma, shopRepository } from "@stocksentry/database";
import {
  getShopGraphqlClient,
  merchantGraphqlRequest,
} from "../shopify/client.js";
import { createObservation } from "./observation.js";
import { monitoredItemSoftLimit } from "./billing.js";
import { evaluateObservation, evaluateStaleMonitoring } from "./detection.js";

const LEVELS_BY_ITEM_QUERY = `#graphql
  query StockSentryLevelsByItem($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        inventoryLevels(first: 20) {
          edges {
            node {
              quantities(names: ["available"]) {
                name
                quantity
              }
              location {
                id
                name
                isActive
              }
            }
          }
        }
      }
    }
  }
`;

type LevelsByItemResponse = {
  data?: {
    nodes?: Array<{
      id?: string;
      inventoryLevels?: {
        edges: Array<{
          node: {
            quantities: Array<{ name: string; quantity: number }>;
            location: { id: string; name: string; isActive?: boolean };
          };
        }>;
      };
    } | null>;
  };
};

async function fetchLevels(
  shopDomain: string,
  sessionToken: string | undefined,
  ids: string[],
): Promise<LevelsByItemResponse> {
  if (sessionToken) {
    return merchantGraphqlRequest<LevelsByItemResponse>(
      shopDomain,
      sessionToken,
      LEVELS_BY_ITEM_QUERY,
      { ids },
    );
  }
  const client = await getShopGraphqlClient(shopDomain);
  const response = await client.request(LEVELS_BY_ITEM_QUERY, {
    variables: { ids },
  });
  return response as LevelsByItemResponse;
}

export type ReconcileResult = {
  compared: number;
  discrepancies: number;
  observationsCreated: number;
  incidentsTouched: number;
};

/**
 * Fetch current Shopify levels for tracked items, compare to latest
 * observation, write RECONCILIATION observations, and run detection.
 */
export async function runReconcile(input: {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
  batchSize?: number;
}): Promise<ReconcileResult> {
  const batchSize = input.batchSize ?? 25;
  const softLimit = await monitoredItemSoftLimit(input.shopId);
  const items = await prisma.inventoryItem.findMany({
    where: { shopId: input.shopId, deletedAt: null, tracked: true },
    select: { id: true, shopifyInventoryItemGid: true },
    orderBy: { createdAt: "asc" },
    take: softLimit,
  });

  let compared = 0;
  let discrepancies = 0;
  let observationsCreated = 0;
  let incidentsTouched = 0;
  const now = new Date();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const gids = batch.map((b) => b.shopifyInventoryItemGid);
    const response = await fetchLevels(
      input.shopDomain,
      input.sessionToken,
      gids,
    );
    const nodes = response.data?.nodes ?? [];

    for (const node of nodes) {
      if (!node?.id || !node.inventoryLevels) continue;
      const localItem = batch.find((b) => b.shopifyInventoryItemGid === node.id);
      if (!localItem) continue;

      for (const edge of node.inventoryLevels.edges) {
        const level = edge.node;
        const location = await prisma.inventoryLocation.upsert({
          where: {
            shopId_shopifyLocationGid: {
              shopId: input.shopId,
              shopifyLocationGid: level.location.id,
            },
          },
          create: {
            shopId: input.shopId,
            shopifyLocationGid: level.location.id,
            name: level.location.name,
            active: level.location.isActive ?? true,
          },
          update: {
            name: level.location.name,
            active: level.location.isActive ?? true,
          },
        });

        const quantity =
          level.quantities.find((q) => q.name === "available")?.quantity ?? 0;

        const { observation, previousQuantity } = await createObservation({
          shopId: input.shopId,
          inventoryItemId: localItem.id,
          locationId: location.id,
          quantity,
          observedAt: now,
          source: "RECONCILIATION",
        });
        observationsCreated += 1;
        compared += 1;

        if (
          previousQuantity !== null &&
          previousQuantity !== quantity
        ) {
          discrepancies += 1;
        }

        const touched = await evaluateObservation({
          shopId: input.shopId,
          inventoryItemId: localItem.id,
          locationId: location.id,
          observationId: observation.id,
          quantity,
          previousQuantity,
          observedAt: now,
          source: "RECONCILIATION",
        });
        incidentsTouched += touched.length;
      }
    }
  }

  await shopRepository.touchReconciled(input.shopId);
  await evaluateStaleMonitoring(input.shopId).catch(() => undefined);

  return { compared, discrepancies, observationsCreated, incidentsTouched };
}
