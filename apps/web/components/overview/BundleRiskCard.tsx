"use client";

import Link from "next/link";
import { Card, CardTitle } from "../Card";
import { EmptyState } from "../shared/EmptyState";
import type { BundleRiskGroup } from "../../lib/types";

interface BundleRiskCardProps {
  groups?: BundleRiskGroup[] | null;
  loading?: boolean;
}

export function BundleRiskCard({
  groups,
  loading = false,
}: BundleRiskCardProps) {
  let chipIndex = 0;

  return (
    <Card hover loading={loading}>
      <CardTitle
        title="Bundle components at risk"
        subtitle="Open incidents or refill-threshold components"
        action={<Link href="/bundles">Groups</Link>}
      />
      {!groups?.length ? (
        <EmptyState
          icon="bu"
          title="No bundle risk signals"
          description="Map bundle groups to see which components have open incidents or low observed quantity."
        />
      ) : (
        groups.map((g) => (
          <div className="bgp" key={g.name}>
            <div className="t">
              {g.name}
              <span className="chip">{g.mapping}</span>
            </div>
            <div className="pl">
              {(g.components ?? []).map((c) => {
                const cIdx = chipIndex++;
                return (
                  <i
                    key={c.name}
                    className={c.atRisk ? "r" : undefined}
                    style={{ ["--c" as string]: cIdx }}
                    title={
                      c.refillAtRisk
                        ? `Refill risk${c.quantity != null ? ` · qty ${c.quantity}` : ""}`
                        : undefined
                    }
                  >
                    {c.name}
                    {c.refillAtRisk ? " · refill" : ""}
                  </i>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
