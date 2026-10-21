"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Icon } from "../../../components/IconSprite";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest, downloadAuthenticated } from "../../../lib/api";
import type { HistoryListResponse, HistoryObservation } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "BASELINE", label: "Baseline" },
  { value: "WEBHOOK", label: "Webhook" },
  { value: "API_READ", label: "API read" },
  { value: "RECONCILIATION", label: "Inventory verification" },
];

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (source) params.set("source", source);
      const res = await apiRequest<HistoryListResponse>(
        `/api/v1/history?${params}`,
        { shop },
      );
      setItems(res?.items ?? []);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
      setTotal(res?.total ?? 0);
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
    if (exporting) return;
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
    <div className="pg">
      <PageHeader
        title="Inventory History"
        subtitle="Observed quantity changes across products and locations."
        actions={
          <Button onClick={() => void onExport()} disabled={exporting}>
            <Icon id="ex" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />
      <Card loading={loading}>
        <div className="filters">
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
            description="Inventory observations from webhooks and scheduled verification will appear here once monitoring is active."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Source</th>
                    <th>Data quality</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{formatWhen(row.observedAt)}</td>
                      <td>
                        <b>{productLabel(row)}</b>
                        {row.inventoryItem?.sku ? (
                          <div className="m mono">SKU {row.inventoryItem.sku}</div>
                        ) : null}
                      </td>
                      <td>{row.location?.name ?? "—"}</td>
                      <td className="q">{row.quantity}</td>
                      <td>
                        <span className="ch">{row.source}</span>
                      </td>
                      <td>{row.dataQuality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>
                Page {page} of {totalPages}
                {total ? ` · ${total.toLocaleString()} observations` : ""}
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
