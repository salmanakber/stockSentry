"use client";

import { Card, CardTitle } from "../Card";
import { EmptyState } from "../shared/EmptyState";
import type { RepeatIncident } from "../../lib/types";

interface RepeatIncidentsProps {
  items?: RepeatIncident[] | null;
  loading?: boolean;
}

export function RepeatIncidents({
  items,
  loading = false,
}: RepeatIncidentsProps) {
  return (
    <Card hover loading={loading}>
      <CardTitle
        title="Repeat incidents"
        subtitle="Same item flagged 3+ times"
      />
      {!items?.length ? (
        <EmptyState
          icon="rf"
          title="No repeat incidents"
          description="Items flagged three or more times in the window will appear here."
        />
      ) : (
        items.map((r) => (
          <div className="rw" key={r.name}>
            <span>{r.name}</span>
            <span className="rb bar in">
              <i
                style={{
                  ["--w" as string]: `${r.pct}%`,
                  background: "var(--hot)",
                }}
              />
            </span>
            <b>{r.count}×</b>
          </div>
        ))
      )}
    </Card>
  );
}
