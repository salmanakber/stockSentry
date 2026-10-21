"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Icon } from "../../../components/IconSprite";
import { PageHeader } from "../../../components/shared/PageHeader";
import { EmptyState } from "../../../components/shared/EmptyState";
import {
  IncidentFilters,
  filterIncidents,
  type IncidentFilterState,
} from "../../../components/incidents/IncidentFilters";
import { IncidentTable } from "../../../components/incidents/IncidentTable";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { apiRequest, downloadAuthenticated } from "../../../lib/api";
import { DEMO_INCIDENTS } from "../../../lib/demo-data";
import { mapApiIncidentRow, type ApiIncident } from "../../../lib/map-incident";
import type { IncidentRow } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

interface IncidentsApiResponse {
  items?: ApiIncident[];
  badges?: { incidents?: number };
  total?: number;
}

export default function IncidentsPage() {
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const productId = searchParams.get("productId")?.trim() || "";
  const { setBadges, ready } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
      setBadges({
        incidents: DEMO_INCIDENTS.filter(
          (i) => i.status !== "resolved" && i.status !== "dismissed",
        ).length,
        notifications: 3,
      });
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (productId) params.set("productId", productId);
      const qs = params.toString();
      const res = await apiRequest<IncidentsApiResponse>(
        `/api/v1/incidents${qs ? `?${qs}` : ""}`,
        { shop },
      );
      const mapped = (res?.items ?? []).map(mapApiIncidentRow);
      setItems(mapped);
      if (res?.badges) setBadges(res.badges);
      else {
        setBadges({
          incidents: mapped.filter(
            (i) => i.status !== "resolved" && i.status !== "dismissed",
          ).length,
        });
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [demo, productId, shop, setBadges]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, ready, loading]);

  const filtered = useMemo(
    () => filterIncidents(items, filters),
    [items, filters],
  );

  const onExport = async () => {
    if (demo) {
      showToast("CSV export is unavailable in demo mode");
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      await downloadAuthenticated(
        "/api/v1/incidents/export.csv",
        "incidents.csv",
        shop,
      );
      showToast("CSV export downloaded");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Incidents"
        subtitle="Deterministic rule flags for review. A flag is not proof of an error."
        actions={
          <Button onClick={() => void onExport()} disabled={exporting}>
            <Icon id="ex" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
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
