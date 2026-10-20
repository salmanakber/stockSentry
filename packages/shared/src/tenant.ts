/**
 * Tenant isolation helper — every shop-scoped query must pass a non-empty shopId.
 * Throws a stable error code so callers and tests can assert isolation.
 */
export function requireShopId(shopId: unknown): string {
  if (typeof shopId !== "string" || shopId.trim().length === 0) {
    throw new Error("TENANT_SHOP_ID_REQUIRED");
  }
  return shopId.trim();
}
