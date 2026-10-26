"use client";

import Link from "next/link";
import { Card, CardTitle } from "../Card";
import { EmptyState } from "../shared/EmptyState";
import { ProductThumb } from "../ProductThumb";
import type { BundleRiskGroup } from "../../lib/types";

interface BundleRiskCardProps {
  groups?: BundleRiskGroup[] | null;
  loading?: boolean;
}

export function BundleRiskCard({
  groups,
  loading = false,
}: BundleRiskCardProps) {
  return (
    <Card hover loading={loading} className="bg-risk-card">
      <CardTitle
        title="Bundle components at risk"
        subtitle="Open incidents or refill-threshold components"
        action={<Link href="/bundles">View groups</Link>}
      />
      {!groups?.length ? (
        <EmptyState
          icon="bu"
          title="No bundle risk signals"
          description="Map bundle groups to see which components have open incidents or low observed quantity."
        />
      ) : (
        <div className="bg-risk-list">
          {groups.map((g) => {
            const atRisk = (g.components ?? []).some(
              (c) => c.atRisk || c.refillAtRisk,
            );
            const shown = (g.components ?? []).slice(0, 3);
            const extra = Math.max(0, (g.components?.length ?? 0) - shown.length);
            return (
              <Link
                key={g.name}
                href="/bundles"
                className="bg-risk-row"
              >
                <div className="bg-risk-main">
                  <b>{g.name}</b>
                  <span className="m">{g.mapping}</span>
                  <div className="bg-stack" style={{ marginTop: 8 }}>
                    {shown.map((c) => (
                      <ProductThumb
                        key={c.name}
                        label={c.name}
                        size="sm"
                        className="bg-stack-thumb"
                      />
                    ))}
                    {extra > 0 ? (
                      <span className="bg-stack-more">+{extra}</span>
                    ) : null}
                  </div>
                </div>
                <span className={`bg-pill ${atRisk ? "low" : "in"}`}>
                  {atRisk ? "At risk" : "Healthy"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
