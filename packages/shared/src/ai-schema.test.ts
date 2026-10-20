import { describe, expect, it } from "vitest";
import {
  AI_SYSTEM_PROMPT,
  aiReportOutputSchema,
  fallbackAiReport,
} from "./ai-schema.js";

const validReport = {
  title: "Sudden drop on SKU-1",
  summary: "Available quantity fell without a matching order spike.",
  why_flagged: "Absolute delta exceeded the configured threshold.",
  confirmed_facts: ["Quantity moved from 100 to 40 within the observe window."],
  possible_explanations: ["Manual adjustment in Shopify admin."],
  recommended_checks: ["Compare inventory history and recent order lines."],
  unknowns: ["Whether a third-party app wrote the change."],
  confidence_note: "Hypothesis only; evidence does not prove a root cause.",
  evidence_version: "ev_test_1",
};

describe("aiReportOutputSchema", () => {
  it("accepts a well-formed report", () => {
    const parsed = aiReportOutputSchema.parse(validReport);
    expect(parsed.title).toBe(validReport.title);
    expect(parsed.evidence_version).toBe("ev_test_1");
  });

  it("rejects empty title and empty fact arrays items", () => {
    expect(() =>
      aiReportOutputSchema.parse({ ...validReport, title: "" }),
    ).toThrow();
    expect(() =>
      aiReportOutputSchema.parse({
        ...validReport,
        confirmed_facts: [""],
      }),
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    const { summary: _summary, ...rest } = validReport;
    expect(() => aiReportOutputSchema.parse(rest)).toThrow();
  });
});

describe("fallbackAiReport", () => {
  it("returns schema-valid output with the given evidence version", () => {
    const report = fallbackAiReport("ev_fallback");
    expect(aiReportOutputSchema.parse(report).evidence_version).toBe(
      "ev_fallback",
    );
  });
});

describe("AI_SYSTEM_PROMPT", () => {
  it("instructs evidence-only explanations", () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/evidence/i);
    expect(AI_SYSTEM_PROMPT).toMatch(/Never invent/i);
  });
});
