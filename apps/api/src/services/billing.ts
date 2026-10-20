import {
  prisma,
  type BillingStatus,
  type Shop,
} from "@stocksentry/database";
import {
  ENTITLEMENT_ERROR_CODES,
  planSlugSchema,
  requireShopId,
  type PlanSlug,
} from "@stocksentry/shared";
import {
  getShopGraphqlClient,
  merchantGraphqlRequest,
} from "../shopify/client.js";
import { resolvePlan } from "./plans.js";

export class EntitlementError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
  }
}

const APP_SUBSCRIPTION_CREATE = `#graphql
  mutation StockSentryAppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
        name
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const CURRENT_SUBSCRIPTIONS_QUERY = `#graphql
  query StockSentryCurrentAppSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        lineItems {
          plan {
            pricingDetails {
              __typename
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const APP_SUBSCRIPTION_CANCEL = `#graphql
  mutation appSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type AppSubscriptionCreateResponse = {
  data?: {
    appSubscriptionCreate?: {
      appSubscription?: {
        id: string;
        status: string;
        name: string;
      } | null;
      confirmationUrl?: string | null;
      userErrors?: Array<{ field?: string[] | null; message: string }>;
    };
  };
};

type CurrentSubscriptionsResponse = {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions?: Array<{
        id: string;
        name: string;
        status: string;
        createdAt?: string;
        currentPeriodEnd?: string | null;
      }>;
    };
  };
};

function embeddedReturnUrl(shopDomain: string): string {
  const base = (
    process.env.EMBEDDED_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/settings?billing=confirm&shop=${encodeURIComponent(shopDomain)}`;
}

function mapShopifyStatus(status: string | undefined): BillingStatus {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "PENDING":
      return "TRIAL";
    case "CANCELLED":
    case "DECLINED":
      return "CANCELLED";
    case "EXPIRED":
    case "FROZEN":
      return "FROZEN";
    default:
      return "NONE";
  }
}

function planSlugFromSubscriptionName(name: string): PlanSlug | null {
  const lower = name.toLowerCase();
  for (const slug of ["pro", "starter", "free"] as const) {
    if (lower.includes(slug)) return slug;
  }
  return null;
}

export async function countMonitoredItems(shopId: string): Promise<number> {
  const id = requireShopId(shopId);
  return prisma.inventoryItem.count({
    where: { shopId: id, deletedAt: null, tracked: true },
  });
}

/**
 * Soft entitlement check for monitored item capacity.
 * Throws EntitlementError when current (+ additional) exceeds plan max.
 */
export async function assertMonitoredItemCapacity(
  shopId: string,
  additional = 0,
): Promise<{ used: number; limit: number; planSlug: string }> {
  const id = requireShopId(shopId);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id } });
  const plan = await resolvePlan(shop.planSlug);
  const used = await countMonitoredItems(id);
  if (used + additional > plan.maxMonitoredItems) {
    throw new EntitlementError(
      ENTITLEMENT_ERROR_CODES.MONITORED_ITEMS_EXCEEDED,
      `Plan ${plan.slug} allows ${plan.maxMonitoredItems} monitored items (have ${used}). Upgrade to monitor more.`,
    );
  }
  return { used, limit: plan.maxMonitoredItems, planSlug: shop.planSlug };
}

/**
 * Soft check used by reconcile/detection — returns the max items this plan
 * may actively monitor (does not throw; callers take() this many).
 */
export async function monitoredItemSoftLimit(shopId: string): Promise<number> {
  const id = requireShopId(shopId);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id } });
  return (await resolvePlan(shop.planSlug)).maxMonitoredItems;
}

export async function getBillingStatus(shopId: string) {
  const id = requireShopId(shopId);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id } });
  const plan = await resolvePlan(shop.planSlug);
  const monitoredItems = await countMonitoredItems(id);
  const openIncidents = await prisma.incident.count({
    where: { shopId: id, status: { in: ["NEW", "INVESTIGATING"] } },
  });

  const entitlementCodes: string[] = [];
  if (monitoredItems > plan.maxMonitoredItems) {
    entitlementCodes.push(ENTITLEMENT_ERROR_CODES.MONITORED_ITEMS_EXCEEDED);
  }
  if (openIncidents > plan.maxOpenIncidents) {
    entitlementCodes.push("ENTITLEMENT_OPEN_INCIDENTS_EXCEEDED");
  }

  return {
    planSlug: shop.planSlug,
    billingStatus: shop.billingStatus,
    shopifySubscriptionGid: shop.shopifySubscriptionGid,
    entitlements: plan,
    usage: {
      monitoredItems,
      maxMonitoredItems: plan.maxMonitoredItems,
      openIncidents,
      maxOpenIncidents: plan.maxOpenIncidents,
    },
    entitlementCodes,
  };
}

/**
 * Create a Shopify app subscription (or activate free locally).
 * Paid plans return a confirmationUrl the merchant must approve.
 */
export async function createPlanSubscription(input: {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
  planSlug: string;
}): Promise<{
  planSlug: PlanSlug;
  confirmationUrl: string | null;
  subscriptionId: string | null;
  billingStatus: BillingStatus;
  shop: Shop;
}> {
  const shopId = requireShopId(input.shopId);
  const parsed = planSlugSchema.safeParse(input.planSlug);
  if (!parsed.success) {
    throw new EntitlementError(
      ENTITLEMENT_ERROR_CODES.INVALID_PLAN,
      `Unknown plan slug: ${input.planSlug}`,
    );
  }
  const planSlug = parsed.data;
  const plan = await resolvePlan(planSlug);

  if (planSlug === "free" || plan.priceUsdMonthly <= 0) {
    const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        planSlug: "free",
        planId: freePlan?.id ?? null,
        planAssignedByAdmin: false,
        billingStatus: "NONE",
        shopifySubscriptionGid: null,
      },
    });
    return {
      planSlug: "free",
      confirmationUrl: null,
      subscriptionId: null,
      billingStatus: shop.billingStatus,
      shop,
    };
  }

  const testBilling =
    process.env.SHOPIFY_BILLING_TEST === "true" ||
    process.env.NODE_ENV !== "production";

  const response = await merchantGraphqlRequest<AppSubscriptionCreateResponse>(
    input.shopDomain,
    input.sessionToken,
    APP_SUBSCRIPTION_CREATE,
    {
      name: `Bundle Safety ${plan.displayName}`,
      returnUrl: embeddedReturnUrl(input.shopDomain),
      trialDays: plan.trialDays ?? 7,
      test: testBilling,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.priceUsdMonthly, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  );

  const payload = response.data?.appSubscriptionCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(
      userErrors.map((e) => e.message).join("; ") || "BILLING_CREATE_FAILED",
    );
  }

  const subscriptionId = payload?.appSubscription?.id ?? null;
  const confirmationUrl = payload?.confirmationUrl ?? null;

  const planRow = await prisma.plan.findUnique({ where: { slug: planSlug } });
  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      // Plan activates after merchant confirms; keep requested slug pending.
      planSlug,
      planId: planRow?.id ?? null,
      planAssignedByAdmin: false,
      billingStatus: "TRIAL",
      shopifySubscriptionGid: subscriptionId,
    },
  });

  return {
    planSlug,
    confirmationUrl,
    subscriptionId,
    billingStatus: shop.billingStatus,
    shop,
  };
}

/**
 * Reconcile local billing fields from Shopify currentAppInstallation.
 */
export async function reconcileSubscriptionStatus(input: {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
}): Promise<{
  planSlug: string;
  billingStatus: BillingStatus;
  shopifySubscriptionGid: string | null;
  activeSubscriptions: Array<{ id: string; name: string; status: string }>;
}> {
  const shopId = requireShopId(input.shopId);

  const response = await merchantGraphqlRequest<CurrentSubscriptionsResponse>(
    input.shopDomain,
    input.sessionToken,
    CURRENT_SUBSCRIPTIONS_QUERY,
  );

  const active =
    response.data?.currentAppInstallation?.activeSubscriptions ?? [];

  if (active.length === 0) {
    const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        planSlug: "free",
        planId: freePlan?.id ?? null,
        billingStatus: "NONE",
        shopifySubscriptionGid: null,
      },
    });
    return {
      planSlug: shop.planSlug,
      billingStatus: shop.billingStatus,
      shopifySubscriptionGid: null,
      activeSubscriptions: [],
    };
  }

  const primary = active[0]!;
  const mappedSlug =
    planSlugFromSubscriptionName(primary.name) ??
    (await prisma.shop.findUniqueOrThrow({ where: { id: shopId } })).planSlug;
  const billingStatus = mapShopifyStatus(primary.status);
  const planRow = await prisma.plan.findUnique({ where: { slug: mappedSlug } });

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      planSlug: mappedSlug,
      planId: planRow?.id ?? null,
      billingStatus,
      shopifySubscriptionGid: primary.id,
    },
  });

  return {
    planSlug: shop.planSlug,
    billingStatus: shop.billingStatus,
    shopifySubscriptionGid: shop.shopifySubscriptionGid,
    activeSubscriptions: active.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
    })),
  };
}

/**
 * Cancel Shopify app subscription(s) while the offline token still works.
 * Prefer stored GID; also cancel any ACTIVE from currentAppInstallation.
 */
export async function cancelShopSubscriptions(
  shopDomain: string,
  shopifySubscriptionGid?: string | null,
): Promise<{ cancelled: string[]; errors: string[] }> {
  const cancelled: string[] = [];
  const errors: string[] = [];

  let client: Awaited<ReturnType<typeof getShopGraphqlClient>>;
  try {
    client = await getShopGraphqlClient(shopDomain);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[billing] cannot cancel subscriptions for ${shopDomain}: ${msg}`,
    );
    return { cancelled, errors: [msg] };
  }

  const ids = new Set<string>();
  if (shopifySubscriptionGid) ids.add(shopifySubscriptionGid);

  try {
    const listed = (await client.request(CURRENT_SUBSCRIPTIONS_QUERY)) as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: Array<{ id: string; status: string }>;
        };
      };
    };
    for (const sub of listed.data?.currentAppInstallation
      ?.activeSubscriptions ?? []) {
      if ((sub.status ?? "").toUpperCase() === "ACTIVE" || sub.id) {
        ids.add(sub.id);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`list: ${msg}`);
  }

  for (const id of ids) {
    try {
      const result = (await client.request(APP_SUBSCRIPTION_CANCEL, {
        variables: { id },
      })) as {
        data?: {
          appSubscriptionCancel?: {
            appSubscription?: { id: string; status: string } | null;
            userErrors?: Array<{ message: string }>;
          };
        };
      };
      const payload = result.data?.appSubscriptionCancel;
      const userErrors = payload?.userErrors ?? [];
      if (userErrors.length) {
        errors.push(
          `${id}: ${userErrors.map((e) => e.message).join("; ")}`,
        );
      } else {
        cancelled.push(id);
        console.info(
          `[billing] cancelled subscription ${id} for ${shopDomain} status=${payload?.appSubscription?.status}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${id}: ${msg}`);
    }
  }

  return { cancelled, errors };
}

/**
 * Stub confirm after merchant returns from Shopify approval URL.
 * Production: prefer APP_SUBSCRIPTIONS_UPDATE webhook + reconcile.
 */
export async function confirmSubscriptionStub(input: {
  shopId: string;
  shopDomain: string;
  sessionToken?: string;
}): Promise<Awaited<ReturnType<typeof reconcileSubscriptionStatus>>> {
  return reconcileSubscriptionStatus(input);
}
