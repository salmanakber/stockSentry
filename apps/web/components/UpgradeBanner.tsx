"use client";

import Link from "next/link";

interface UpgradeBannerProps {
  code?: string | null;
  message?: string | null;
  className?: string;
}

/** Surfaces ENTITLEMENT_* API failures with a path to Billing. */
export function UpgradeBanner({
  code,
  message,
  className = "",
}: UpgradeBannerProps) {
  if (!code && !message) return null;
  const isEntitlement = Boolean(code?.startsWith("ENTITLEMENT_"));
  if (!isEntitlement && !message) return null;

  return (
    <div className={`upgrade-banner ${className}`.trim()} role="status">
      <div>
        <strong>Plan limit reached</strong>
        <span>{message ?? "Upgrade your plan to unlock this feature."}</span>
      </div>
      <Link href="/billing" className="btn primary">
        Upgrade
      </Link>
    </div>
  );
}

export function upgradeTooltip(locked = true): string | undefined {
  return locked ? "Upgrade to Pro" : undefined;
}
