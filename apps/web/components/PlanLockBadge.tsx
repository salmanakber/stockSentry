"use client";

import Link from "next/link";

interface PlanLockBadgeProps {
  /** When false/undefined, render nothing. */
  locked?: boolean;
  /** Short chip label. */
  label?: "Upgrade" | "Not on your plan";
  className?: string;
}

/** Small plan-gate chip linking to Billing. */
export function PlanLockBadge({
  locked = true,
  label = "Upgrade",
  className = "",
}: PlanLockBadgeProps) {
  if (!locked) return null;
  return (
    <Link
      href="/billing"
      className={`plan-lock${label === "Not on your plan" ? " muted" : ""}${className ? ` ${className}` : ""}`}
      title="View plans in Billing"
    >
      {label}
    </Link>
  );
}
