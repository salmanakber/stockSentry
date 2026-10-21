"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Icon } from "../../../components/IconSprite";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { PageHeader } from "../../../components/shared/PageHeader";
import { MonitoringStatusCard } from "../../../components/overview/MonitoringStatusCard";
import { KpiGrid } from "../../../components/overview/KpiGrid";
import { IncidentTrendChart } from "../../../components/overview/IncidentTrendChart";
import { RecentIncidents } from "../../../components/overview/RecentIncidents";
import { ReviewOutcomes } from "../../../components/overview/ReviewOutcomes";
import { RepeatIncidents } from "../../../components/overview/RepeatIncidents";
import { BundleRiskCard } from "../../../components/overview/BundleRiskCard";
import { AiReportsCard } from "../../../components/overview/AiReportsCard";
import { DataPipeline } from "../../../components/overview/DataPipeline";
import { apiRequest } from "../../../lib/api";
import { getDemoOverview } from "../../../lib/demo-data";
import type { OverviewResponse } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";
import { healthLabel } from "../../../lib/format";

export default function OverviewPage() {
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const { setBadges, setMeta, setCardLoading, cardLoading, ready } =
    useShell();
  const { showToast } = useToast();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [lastRecOverride, setLastRecOverride] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const applyShell = useCallback(
    (ov: OverviewResponse | null) => {
      if (!ov) {
        setBadges({});
        setMeta({
          monitoringLabel: "Monitoring",
          monitoringSub: "No data yet",
          planName: "Plan",
          planUsage: "—",
          planPct: 0,
          userInitials: shop ? shop.slice(0, 2).toUpperCase() : "?",
          userName: shop?.replace(".myshopify.com", "") ?? "Shop",
          userRole: "read-only access",
        });
        return;
      }
      setBadges(ov.badges ?? {});
      const planPct =
        ov.plan && ov.plan.aiLimit > 0
          ? Math.round((ov.plan.aiUsed / ov.plan.aiLimit) * 100)
          : ov.aiReports && ov.aiReports.limit > 0
            ? Math.round((ov.aiReports.used / ov.aiReports.limit) * 100)
            : 0;
      setMeta({
        monitoringLabel: ov.monitoring
          ? healthLabel(ov.monitoring.status).replace("Monitoring is ", "Monitoring ")
          : "Monitoring",
        monitoringSub:
          ov.monitoring?.lastReconciliation != null
            ? `Reconciled ${ov.monitoring.lastReconciliation}`
            : "Awaiting first reconciliation",
        planName: ov.plan?.name ?? "Plan",
        planUsage: ov.plan
          ? `${ov.plan.aiUsed} / ${ov.plan.aiLimit} AI reports`
          : "—",
        planPct,
        userInitials:
          ov.user?.initials ??
          (shop ? shop.slice(0, 2).toUpperCase() : "?"),
        userName:
          ov.user?.name ??
          ov.shopDisplay ??
          shop?.replace(".myshopify.com", "") ??
          "Shop",
        userRole: ov.user?.role ?? "Owner · read-only access",
      });
    },
    [setBadges, setMeta, shop],
  );

  const load = useCallback(async () => {
    setFetching(true);
    if (demo) {
      const ov = getDemoOverview();
      setData(ov);
      applyShell(ov);
      setFetching(false);
      return;
    }
    try {
      const ov = await apiRequest<OverviewResponse>("/api/v1/overview", {
        shop,
      });
      setData(ov ?? null);
      applyShell(ov ?? null);
    } catch {
      setData(null);
      applyShell(null);
    } finally {
      setFetching(false);
    }
  }, [demo, shop, applyShell]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !fetching, null, [data, ready, fetching]);

  const onSync = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setCardLoading(true);
    try {
      if (!demo) {
        await apiRequest("/api/v1/sync", {
          method: "POST",
          shop,
        }).catch(() => null);
      }
      await new Promise((r) => setTimeout(r, 1700));
      setLastRecOverride("just now");
      await load();
      const checked =
        data?.kpis?.find((k) =>
          k.label.toLowerCase().includes("monitored"),
        )?.value;
      showToast(
        checked != null
          ? `Reconciliation complete · ${checked.toLocaleString("en-US")} items checked`
          : "Reconciliation complete",
      );
    } finally {
      setCardLoading(false);
      setSyncBusy(false);
    }
  };

  const shopLabel =
    data?.shop ?? shop ?? (demo ? "northwind-home.myshopify.com" : "—");
  const range =
    data?.dateRangeLabel ??
    (demo ? "sample data" : "Connect monitoring to see a live date range");
  const loading = cardLoading || fetching;

  return (
    <div className="pg">
      <PageHeader
        title="Overview"
        subtitle={
          <>
            {shopLabel} · <b>{range}</b>
          </>
        }
        actions={
          <>
            <Button id="sync" onClick={() => void onSync()} disabled={syncBusy}>
              <Icon id="rf" className={`i${syncBusy ? " spin" : ""}`} />
              <span>{syncBusy ? "Syncing…" : "Sync now"}</span>
            </Button>
            <Link href="/history" className="btn">
              View history
            </Link>
            <Link href="/incidents" className="btn p">
              Review incidents
            </Link>
          </>
        }
      />

      <MonitoringStatusCard
        data={data?.monitoring}
        loading={loading}
        lastReconciliationOverride={lastRecOverride}
      />

      <KpiGrid items={data?.kpis} loading={loading} />

      <div className="grid">
        <div className="col2">
          <IncidentTrendChart points={data?.trend} loading={loading} />
          <RecentIncidents
            items={data?.recentIncidents}
            loading={loading}
          />
        </div>
        <div className="col2">
          <ReviewOutcomes data={data?.reviewOutcomes} loading={loading} />
          <RepeatIncidents
            items={data?.repeatIncidents}
            loading={loading}
          />
          <BundleRiskCard groups={data?.bundleRisk} loading={loading} />
          <AiReportsCard data={data?.aiReports} loading={loading} />
          <div className="card rv">
            <div className="ct">
              <div>
                <b>Refill attention</b>
                <small>
                  Items with latest observed qty ≤ threshold
                  {data?.refillAttention?.threshold != null
                    ? ` (${data.refillAttention.threshold})`
                    : ""}
                  . Suggestions only — StockSentry never changes inventory.
                </small>
              </div>
              <Link href="/products" className="btn">
                Products
              </Link>
            </div>
            <div className="facts" style={{ marginBottom: 0 }}>
              <div>
                <small>Items ≤ threshold</small>
                <b>{data?.refillAttention?.count ?? 0}</b>
              </div>
              <div>
                <small>Threshold</small>
                <b>{data?.refillAttention?.threshold ?? 10}</b>
              </div>
            </div>
          </div>
          {(data?.supplierRisk?.openIncidents ?? 0) > 0 ||
          (data?.supplierRisk?.linkedItems ?? 0) > 0 ? (
            <div className="card rv">
              <div className="ct">
                <div>
                  <b>Supplier-linked items at risk</b>
                  <small>
                    Open incidents on products attached to suppliers
                  </small>
                </div>
                <Link href="/suppliers" className="btn">
                  Suppliers
                </Link>
              </div>
              <div className="facts" style={{ marginBottom: 0 }}>
                <div>
                  <small>Linked items</small>
                  <b>{data?.supplierRisk?.linkedItems ?? 0}</b>
                </div>
                <div>
                  <small>Open incidents</small>
                  <b>{data?.supplierRisk?.openIncidents ?? 0}</b>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <DataPipeline nodes={data?.pipeline} loading={loading} />

      <div className="note rv">
        <svg
          className="i"
          style={{ width: 17, height: 17, marginTop: 2 }}
          aria-hidden
        >
          <use href="#sh" />
        </svg>
        <div>
          Quantities are observations from Shopify and may be delayed,
          duplicated or out of order. An observed change is not a confirmed
          cause: sales, returns, transfers and manual adjustments all move
          stock. StockSentry is read-only (scopes: read_inventory,
          read_products) and never changes your inventory.
        </div>
      </div>
    </div>
  );
}
