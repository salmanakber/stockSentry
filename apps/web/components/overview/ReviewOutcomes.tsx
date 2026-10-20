"use client";

import { Card, CardTitle } from "../Card";
import { EmptyState } from "../shared/EmptyState";
import type { ReviewOutcomes as ReviewOutcomesData } from "../../lib/types";

interface ReviewOutcomesProps {
  data?: ReviewOutcomesData | null;
  loading?: boolean;
}

export function ReviewOutcomes({ data, loading = false }: ReviewOutcomesProps) {
  if (!data) {
    return (
      <Card hover loading={loading}>
        <CardTitle
          title="Review outcomes"
          subtitle="All incidents, last 14 days"
        />
        <EmptyState
          icon="sh"
          title="No review outcomes"
          description="Resolved and dismissed counts appear after incidents are reviewed."
        />
      </Card>
    );
  }

  const total = data.resolved + data.dismissed + data.open || 1;

  return (
    <Card hover loading={loading}>
      <CardTitle
        title="Review outcomes"
        subtitle="All incidents, last 14 days"
      />
      <div className="oc">
        <i
          style={{
            ["--f" as string]: data.resolved,
            ["--k" as string]: 0,
            background: "var(--acc)",
          }}
        />
        <i
          style={{
            ["--f" as string]: data.dismissed,
            ["--k" as string]: 1,
            background: "#98a2b3",
          }}
        />
        <i
          style={{
            ["--f" as string]: data.open,
            ["--k" as string]: 2,
            background: "var(--warn)",
          }}
        />
      </div>
      <div className="rw">
        <span>
          <b data-n={data.resolved}>0</b> resolved
        </span>
        <span>
          <b data-n={data.dismissed}>0</b> dismissed as expected
        </span>
      </div>
      <div className="rw" style={{ borderTop: 0, paddingTop: 0 }}>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--mut)" }}>
          {data.open} still open · {data.detected} detected
          {total ? "" : ""}
        </span>
      </div>
    </Card>
  );
}
