"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "../../../components/Card";
import { PageHeader } from "../../../components/shared/PageHeader";
import { EmptyState } from "../../../components/shared/EmptyState";
import {
  IncidentFilters,
  filterIncidents,
  type IncidentFilterState,
} from "../../../components/incidents/IncidentFilters";
import { IncidentTable } from "../../../components/incidents/IncidentTable";
import { useShell } from "../../../components/AppShell";
import { apiRequest } from "../../../lib/api";
import { DEMO_INCIDENTS } from "../../../lib/demo-data";
import type { IncidentRow, IncidentsListResponse } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

export default function IncidentsPage() {
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const { setBadges, ready } = useShell();
  const [items, setItems] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<IncidentFilterState>({
    severity: "",
    status: "",
    source: "",
    q: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    if (demo) {
      setItems(DEMO_INCIDENTS);
      setBadges({ incidents: DEMO_INCIDENTS.filter((i) => i.status !== "resolved" && i.status !== "dismissed").length, notifications: 3 });
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<IncidentsListResponse>("/api/v1/incidents", {
        shop,
      });
      setItems(res?.items ?? []);
      if (res?.badges) setBadges(res.badges);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [demo, shop, setBadges]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, ready, loading]);

  const filtered = useMemo(
    () => filterIncidents(items, filters),
    [items, filters],
  );

  return (
    <div className="pg">
      <PageHeader
        title="Incidents"
        subtitle="Deterministic rule flags for review. A flag is not proof of an error."
      />
      <Card loading={loading}>
        <IncidentFilters value={filters} onChange={setFilters} />
        {!filtered.length ? (
          <EmptyState
            icon="in"
            title={items.length ? "No matching incidents" : "No incidents yet"}
            description={
              items.length
                ? "Try clearing filters or broadening your search."
                : "Incidents appear when inventory observations trip a detection rule."
            }
          />
        ) : (
          <IncidentTable items={filtered} />
        )}
      </Card>
    </div>
  );
}
