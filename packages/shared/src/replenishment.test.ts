import { describe, expect, it } from "vitest";
import {
  buildReplenishmentDedupeKey,
  canAutoSendReplenishmentEmail,
  isBelowReplenishmentThreshold,
  isOpenReplenishmentStatus,
  isWithinSuppressionWindow,
  shouldTriggerReplenishment,
} from "./replenishment.js";

describe("buildReplenishmentDedupeKey", () => {
  it("includes shop, item, supplier, and UTC day", () => {
    const key = buildReplenishmentDedupeKey({
      shopId: "shop1",
      supplierId: "sup1",
      inventoryItemId: "item1",
      at: new Date("2026-03-15T18:00:00.000Z"),
    });
    expect(key).toBe("shop1|item:item1|sup:sup1|day:2026-03-15");
  });

  it("uses group target when no item", () => {
    const key = buildReplenishmentDedupeKey({
      shopId: "shop1",
      supplierId: "sup1",
      bundleGroupId: "grp1",
      at: new Date("2026-03-15T00:00:00.000Z"),
    });
    expect(key).toBe("shop1|group:grp1|sup:sup1|day:2026-03-15");
  });
});

describe("isBelowReplenishmentThreshold", () => {
  it("triggers when qty equals threshold", () => {
    expect(isBelowReplenishmentThreshold(10, 10)).toBe(true);
  });

  it("triggers when qty is below threshold", () => {
    expect(isBelowReplenishmentThreshold(3, 10)).toBe(true);
  });

  it("does not trigger above threshold", () => {
    expect(isBelowReplenishmentThreshold(11, 10)).toBe(false);
  });
});

describe("isWithinSuppressionWindow", () => {
  it("returns false when never triggered", () => {
    expect(isWithinSuppressionWindow(null)).toBe(false);
  });

  it("returns true within window", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    const last = new Date("2026-03-15T06:00:00.000Z");
    expect(isWithinSuppressionWindow(last, now, 24)).toBe(true);
  });

  it("returns false after window", () => {
    const now = new Date("2026-03-16T13:00:00.000Z");
    const last = new Date("2026-03-15T12:00:00.000Z");
    expect(isWithinSuppressionWindow(last, now, 24)).toBe(false);
  });
});

describe("shouldTriggerReplenishment", () => {
  it("skips when inactive or above threshold or suppressed or open", () => {
    expect(
      shouldTriggerReplenishment({
        quantity: 5,
        lowStockThreshold: 10,
        ruleActive: false,
        openRequestExists: false,
      }).reason,
    ).toBe("rule_inactive");

    expect(
      shouldTriggerReplenishment({
        quantity: 20,
        lowStockThreshold: 10,
        ruleActive: true,
        openRequestExists: false,
      }).reason,
    ).toBe("above_threshold");

    expect(
      shouldTriggerReplenishment({
        quantity: 5,
        lowStockThreshold: 10,
        ruleActive: true,
        lastTriggeredAt: new Date(),
        openRequestExists: false,
      }).reason,
    ).toBe("suppression_window");

    expect(
      shouldTriggerReplenishment({
        quantity: 5,
        lowStockThreshold: 10,
        ruleActive: true,
        openRequestExists: true,
      }).reason,
    ).toBe("open_request_exists");
  });

  it("triggers when qty at/below threshold and clear", () => {
    expect(
      shouldTriggerReplenishment({
        quantity: 2,
        lowStockThreshold: 10,
        ruleActive: true,
        openRequestExists: false,
        lastTriggeredAt: null,
      }),
    ).toEqual({ trigger: true });
  });
});

describe("canAutoSendReplenishmentEmail", () => {
  it("requires auto, no approval, verified, valid email, not demo", () => {
    expect(
      canAutoSendReplenishmentEmail({
        autoEmailEnabled: true,
        requireApproval: false,
        supplierVerified: true,
        supplierEmail: "ops@supplier.com",
      }),
    ).toBe(true);

    expect(
      canAutoSendReplenishmentEmail({
        autoEmailEnabled: true,
        requireApproval: false,
        supplierVerified: true,
        supplierEmail: "ops@supplier.com",
        demoMode: true,
      }),
    ).toBe(false);

    expect(
      canAutoSendReplenishmentEmail({
        autoEmailEnabled: true,
        requireApproval: true,
        supplierVerified: true,
        supplierEmail: "ops@supplier.com",
      }),
    ).toBe(false);

    expect(
      canAutoSendReplenishmentEmail({
        autoEmailEnabled: true,
        requireApproval: false,
        supplierVerified: false,
        supplierEmail: "ops@supplier.com",
      }),
    ).toBe(false);
  });
});

describe("isOpenReplenishmentStatus", () => {
  it("treats draft/pending/queued as open", () => {
    expect(isOpenReplenishmentStatus("DRAFT")).toBe(true);
    expect(isOpenReplenishmentStatus("PENDING_APPROVAL")).toBe(true);
    expect(isOpenReplenishmentStatus("QUEUED")).toBe(true);
    expect(isOpenReplenishmentStatus("SENT")).toBe(false);
    expect(isOpenReplenishmentStatus("CANCELLED")).toBe(false);
  });
});
