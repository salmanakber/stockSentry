import { describe, expect, it } from "vitest";
import {
  absoluteDelta,
  exceedsAbsoluteThreshold,
  exceedsPercentageThreshold,
  percentageChange,
  signedDelta,
} from "./detection-math.js";

describe("absoluteDelta", () => {
  it("returns null when previous is unknown", () => {
    expect(absoluteDelta(null, 50)).toBeNull();
  });

  it("returns absolute difference", () => {
    expect(absoluteDelta(100, 70)).toBe(30);
    expect(absoluteDelta(10, 40)).toBe(30);
  });
});

describe("signedDelta", () => {
  it("never invents a baseline", () => {
    expect(signedDelta(null, 5)).toBeNull();
  });

  it("preserves sign", () => {
    expect(signedDelta(100, 80)).toBe(-20);
    expect(signedDelta(10, 25)).toBe(15);
  });
});

describe("percentageChange", () => {
  it("returns null for unknown previous", () => {
    expect(percentageChange(null, 50)).toBeNull();
  });

  it("returns null for zero baseline (do not invent %)", () => {
    expect(percentageChange(0, 25)).toBeNull();
    expect(percentageChange(0, 0)).toBeNull();
  });

  it("computes percentage from non-zero baseline", () => {
    expect(percentageChange(100, 50)).toBe(50);
    expect(percentageChange(20, 40)).toBe(100);
  });
});

describe("exceedsAbsoluteThreshold", () => {
  it("does not fire without previous quantity", () => {
    expect(exceedsAbsoluteThreshold(null, 1000, 30)).toBe(false);
  });

  it("fires when delta meets threshold", () => {
    expect(exceedsAbsoluteThreshold(100, 60, 30)).toBe(true);
    expect(exceedsAbsoluteThreshold(100, 80, 30)).toBe(false);
  });
});

describe("exceedsPercentageThreshold", () => {
  it("skips when previous below minBaseline", () => {
    expect(exceedsPercentageThreshold(10, 0, 50, 20)).toBe(false);
  });

  it("skips zero baseline", () => {
    expect(exceedsPercentageThreshold(0, 50, 50, 0)).toBe(false);
  });

  it("fires for large percentage drops", () => {
    expect(exceedsPercentageThreshold(100, 40, 50, 20)).toBe(true);
    expect(exceedsPercentageThreshold(100, 60, 50, 20)).toBe(false);
  });
});
