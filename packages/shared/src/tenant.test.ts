import { describe, expect, it } from "vitest";
import { requireShopId } from "./tenant.js";

describe("requireShopId", () => {
  it("returns trimmed shopId", () => {
    expect(requireShopId("shop_abc")).toBe("shop_abc");
    expect(requireShopId("  shop_abc  ")).toBe("shop_abc");
  });

  it("rejects missing tenant scope", () => {
    expect(() => requireShopId(undefined)).toThrow("TENANT_SHOP_ID_REQUIRED");
    expect(() => requireShopId(null)).toThrow("TENANT_SHOP_ID_REQUIRED");
    expect(() => requireShopId("")).toThrow("TENANT_SHOP_ID_REQUIRED");
    expect(() => requireShopId("   ")).toThrow("TENANT_SHOP_ID_REQUIRED");
  });
});
