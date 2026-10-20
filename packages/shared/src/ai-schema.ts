import { z } from "zod";

/** Structured AI incident report output — validated server-side. */
export const aiReportOutputSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  why_flagged: z.string().min(1).max(2000),
  confirmed_facts: z.array(z.string().min(1).max(500)).max(20),
  possible_explanations: z.array(z.string().min(1).max(500)).max(20),
  recommended_checks: z.array(z.string().min(1).max(500)).max(20),
  unknowns: z.array(z.string().min(1).max(500)).max(20),
  confidence_note: z.string().min(1).max(1000),
  evidence_version: z.string().min(1).max(128),
});

export type AiReportOutput = z.infer<typeof aiReportOutputSchema>;

export const AI_SYSTEM_PROMPT =
  "You are an inventory incident explanation assistant. Explain only the evidence supplied by the application. Never invent inventory events, order activity, app names, users, quantities, timestamps, or causes. Separate confirmed facts from possible explanations. Do not present a hypothesis as a confirmed cause. Never perform or recommend automatic inventory writes. If evidence is incomplete, state the limitation and suggest checks possible with available data.";

export function fallbackAiReport(evidenceVersion: string): AiReportOutput {
  return {
    title: "AI report unavailable",
    summary:
      "A deterministic fallback was used because the AI provider did not return a valid report.",
    why_flagged:
      "The incident was created by a deterministic detection rule. Review the evidence timeline for details.",
    confirmed_facts: [
      "An incident was created from observed inventory evidence.",
      "AI explanation was not available or failed validation.",
    ],
    possible_explanations: [
      "Provider timeout, invalid output, or usage limit may have prevented generation.",
    ],
    recommended_checks: [
      "Review the evidence timeline and quantity observations.",
      "Confirm monitoring health and last reconciliation time.",
      "Retry report generation if quota remains.",
    ],
    unknowns: [
      "Cause of the inventory change cannot be asserted without additional evidence.",
    ],
    confidence_note:
      "This fallback does not claim a root cause. Treat hypotheses as unverified.",
    evidence_version: evidenceVersion,
  };
}
