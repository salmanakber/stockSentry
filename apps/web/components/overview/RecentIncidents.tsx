"use client";

import Link from "next/link";
import { Card, CardTitle } from "../Card";
import { IncidentTable } from "../incidents/IncidentTable";
import { EmptyState } from "../shared/EmptyState";
import type { IncidentRow } from "../../lib/types";

interface RecentIncidentsProps {
  items?: IncidentRow[] | null;
  loading?: boolean;
}

export function RecentIncidents({
  items,
  loading = false,
}: RecentIncidentsProps) {
  return (
    <Card loading={loading}>
      <CardTitle
        title="Recent suspicious changes"
        subtitle="Flagged by monitoring rules. A flag is not proof of an error."
        action={<Link href="/incidents">All incidents</Link>}
      />
      {!items?.length ? (
        <EmptyState
          icon="in"
          title="No incidents yet"
          description="When detection rules flag a suspicious inventory change, it will show up here for review."
        />
      ) : (
        <IncidentTable items={items} />
      )}
    </Card>
  );
}
