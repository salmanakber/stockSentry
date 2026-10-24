"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Icon } from "../../../components/IconSprite";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest, downloadAuthenticated } from "../../../lib/api";
import type {
  BillingStatusResponse,
  HistoryListResponse,
  HistoryObservation,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "BASELINE", label: "Initial snapshot" },
  { value: "WEBHOOK", label: "Live store update" },
  { value: "API_READ", label: "Manual refresh" },
  { value: "RECONCILIATION", label: "Scheduled verification" },
];

const SOURCE_LABELS: Record<string, string> = {
  BASELINE: "Initial snapshot",
  WEBHOOK: "Live store update",
  API_READ: "Manual refresh",
  RECONCILIATION: "Scheduled verification",
};

const QUALITY_LABELS: Record<string, string> = {
  COMPLETE: "Complete",
  PARTIAL: "Partial",
  STALE: "Needs refresh",
  UNKNOWN_BASELINE: "First reading",
  DEGRADED: "Degraded",
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function productLabel(row: HistoryObservation): string {
  const item = row.inventoryItem;
  if (!item) return "—";
  const base = item.productTitle?.trim() || "Untitled";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

function initials(row: HistoryObservation): string {
  const title = row.inventoryItem?.productTitle?.trim() || "?";
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function qualityLabel(q: string): string {
  return QUALITY_LABELS[q] ?? q;
}

export default function HistoryPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<HistoryObservation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportsEnabled, setExportsEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (source) params.set("source", source);
      const [res, bill] = await Promise.all([
        apiRequest<HistoryListResponse>(`/api/v1/history?${params}`, {
          shop,
        }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() => null),
      ]);
      setItems(res?.items ?? []);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
      setTotal(res?.total ?? 0);
      if (bill?.entitlements?.exportsEnabled != null) {
        setExportsEnabled(Boolean(bill.entitlements.exportsEnabled));
      }
    } catch {
      setItems([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, shop, source]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, ready, loading]);

  const onExport = async () => {
    if (exporting || !exportsEnabled) return;
    setExporting(true);
    try {
      await downloadAuthenticated(
        "/api/v1/history/export.csv",
        "observations.csv",
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
    <div className="pg hist-page">
      <PageHeader
        title="Inventory History"
        subtitle="A timeline of quantity readings across products and locations."
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!exportsEnabled ? <PlanLockBadge /> : null}
            <Button
              onClick={() => void onExport()}
              disabled={exporting || !exportsEnabled}
            >
              <Icon id="ex" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        }
      />
      <Card loading={loading}>
        <div className="hist-filters filters">
          <select
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value);
            }}
            aria-label="Source"
          >
            {SOURCES.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {!items.length ? (
          <EmptyState
            icon="hi"
            title="No history yet"
            description="Quantity readings from live store updates and scheduled verification will appear here once monitoring is active."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Source</th>
                    <th>Quality</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const delta = row.quantityDelta;
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="hist-prod">
                            <div className="hist-thumb">
                              {row.inventoryItem?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.inventoryItem.imageUrl}
                                  alt=""
                                />
                              ) : (
                                initials(row)
                              )}
                            </div>
                            <div className="hist-prod-meta">
                              <b>{productLabel(row)}</b>
                              {row.inventoryItem?.sku ? (
                                <div className="sku mono">
                                  SKU {row.inventoryItem.sku}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>{row.location?.name ?? "—"}</td>
                        <td>
                          <span className="hist-qty">{row.quantity}</span>
                          {delta != null && delta !== 0 ? (
                            <span
                              className={`hist-delta ${delta > 0 ? "up" : "down"}`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className="hist-chip src">
                            {sourceLabel(row.source)}
                          </span>
                        </td>
                        <td>
                          <span className="hist-chip">
                            {qualityLabel(row.dataQuality)}
                          </span>
                        </td>
                        <td className="mono">{formatWhen(row.observedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>
                Page {page} of {totalPages}
                {total ? ` · ${total.toLocaleString()} readings` : ""}
              </span>
              <div className="btns">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
