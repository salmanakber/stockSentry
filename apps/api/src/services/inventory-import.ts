import { prisma, shopRepository } from "@stocksentry/database";
import {
  getShopGraphqlClient,
  merchantGraphqlRequest,
} from "../shopify/client.js";
import { createObservation } from "./observation.js";
import { EntitlementError, assertMonitoredItemCapacity } from "./billing.js";

const INVENTORY_LEVELS_QUERY = `#graphql
  query StockSentryInventoryLevels($cursor: String) {
    inventoryItems(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          tracked
          sku
          variant {
            id
            title
            product {
              id
              title
              featuredImage {
                url
              }
            }
          }
          inventoryLevels(first: 20) {
            edges {
              node {
                id
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
  }
`;

type InventoryLevelsResponse = {
  data?: {
    inventoryItems?: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: {
          id: string;
          tracked: boolean;
          sku?: string | null;
          variant?: {
            id: string;
            title?: string | null;
            product?: {
              id: string;
              title?: string | null;
              featuredImage?: { url?: string | null } | null;
            } | null;
          } | null;
          inventoryLevels: {
            edges: Array<{
              node: {
                quantities: Array<{ name: string; quantity: number }>;
                location: {
                  id: string;
                  name: string;
                  isActive?: boolean;
                };
              };
            }>;
          };
        };
      }>;
    };
  };
};

async function runInventoryQuery(
  shopDomain: string,
  sessionToken: string | undefined,
  cursor: string | null,
): Promise<InventoryLevelsResponse> {
  if (sessionToken) {
    return merchantGraphqlRequest<InventoryLevelsResponse>(
      shopDomain,
      sessionToken,
      INVENTORY_LEVELS_QUERY,
      { cursor },
    );
  }
  const client = await getShopGraphqlClient(shopDomain);
  const response = await client.request(INVENTORY_LEVELS_QUERY, {
    variables: { cursor },
  });
  return response as InventoryLevelsResponse;
}

export type BaselineImportResult = {
  itemsUpserted: number;
  locationsUpserted: number;
  observationsCreated: number;
};

/**
 * Paginate Shopify inventory items/levels and upsert local rows.
 * Creates BASELINE observations for each level.
 */
export async function runBaselineImport(input: {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
}): Promise<BaselineImportResult> {
  let cursor: string | null = null;
  let hasNext = true;
  let itemsUpserted = 0;
  let locationsUpserted = 0;
  let observationsCreated = 0;
  const now = new Date();

  while (hasNext) {
    const response = await runInventoryQuery(
      input.shopDomain,
      input.sessionToken,
      cursor,
    );
    const connection = response.data?.inventoryItems;
    if (!connection) break;

    for (const edge of connection.edges) {
      const node = edge.node;
      const item = await prisma.inventoryItem.upsert({
        where: {
          shopId_shopifyInventoryItemGid: {
            shopId: input.shopId,
            shopifyInventoryItemGid: node.id,
          },
        },
        create: {
          shopId: input.shopId,
          shopifyInventoryItemGid: node.id,
          productGid: node.variant?.product?.id ?? null,
          variantGid: node.variant?.id ?? null,
          productTitle: node.variant?.product?.title ?? null,
          variantTitle: node.variant?.title ?? null,
          sku: node.sku ?? null,
          imageUrl: node.variant?.product?.featuredImage?.url ?? null,
          tracked: node.tracked,
          deletedAt: null,
        },
        update: {
          productGid: node.variant?.product?.id ?? null,
          variantGid: node.variant?.id ?? null,
          productTitle: node.variant?.product?.title ?? null,
          variantTitle: node.variant?.title ?? null,
          sku: node.sku ?? null,
          imageUrl: node.variant?.product?.featuredImage?.url ?? null,
          tracked: node.tracked,
          deletedAt: null,
        },
      });
      itemsUpserted += 1;

      for (const levelEdge of node.inventoryLevels.edges) {
        const level = levelEdge.node;
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
        locationsUpserted += 1;

        const available =
          level.quantities.find((q) => q.name === "available")?.quantity ?? 0;

        await createObservation({
          shopId: input.shopId,
          inventoryItemId: item.id,
          locationId: location.id,
          quantity: available,
          observedAt: now,
          source: "BASELINE",
          dataQuality: "COMPLETE",
        });
        observationsCreated += 1;
      }
    }

    hasNext = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  await shopRepository.touchReconciled(input.shopId);

  // Soft entitlement check — import never fails; overage is reported via billing status
  // and reconcile only actively monitors up to the plan maxMonitoredItems.
  try {
    await assertMonitoredItemCapacity(input.shopId, 0);
  } catch (err) {
    if (err instanceof EntitlementError) {
      console.warn(
        `[inventory-import] ${err.code} shop=${input.shopId}: ${err.message}`,
      );
    }
  }

  return { itemsUpserted, locationsUpserted, observationsCreated };
}
