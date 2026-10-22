"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest, downloadAuthenticated } from "../../../lib/api";
import type {
  BillingStatusResponse,
  ExportJob,
  ExportsListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const EXPORT_TYPES = [
  { value: "incidents", label: "Incidents" },
  { value: "observations", label: "Observations" },
  { value: "history", label: "History" },
];

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
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

export default function ExportsPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportType, setExportType] = useState("incidents");
  const [creating, setCreating] = useState(false);
  const [exportsEnabled, setExportsEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, bill] = await Promise.all([
        apiRequest<ExportsListResponse>("/api/v1/exports", { shop }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() => null),
      ]);
      setItems(res?.items ?? []);
      if (bill?.entitlements?.exportsEnabled != null) {
        setExportsEnabled(Boolean(bill.entitlements.exportsEnabled));
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, ready, loading]);

  const createJob = async () => {
    if (creating || !exportsEnabled) return;
    setCreating(true);
    try {
      await apiRequest("/api/v1/exports", {
        method: "POST",
        shop,
        body: JSON.stringify({ exportType }),
      });
      showToast("Export job queued");
      // Refresh until COMPLETED or timeout
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 800));
        await load();
        const res = await apiRequest<ExportsListResponse>("/api/v1/exports", {
          shop,
        }).catch(() => null);
        const latest = res?.items?.[0];
        if (
          latest &&
          (latest.status === "COMPLETED" || latest.status === "FAILED")
        ) {
          break;
        }
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      showToast(
        msg.includes("exports_not_enabled") || msg.includes("EXPORTS")
          ? "Exports require Starter or Pro — upgrade in Settings."
          : msg,
      );
    } finally {
      setCreating(false);
    }
  };

  const downloadJob = async (job: ExportJob) => {
    try {
      const path =
        job.resultUrl?.startsWith("/api/")
          ? job.resultUrl
          : `/api/v1/exports/${encodeURIComponent(job.id)}/download`;
      await downloadAuthenticated(
        path,
        `stocksentry-${job.exportType}-${job.id}.csv`,
        shop,
      );
      showToast("Download started");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Exports"
        subtitle="Queued CSV export jobs for incidents and observations."
      />

      <div className="split">
        <Card>
          <CardTitle
            title="New export"
            subtitle="Jobs run asynchronously; results appear when complete"
          />
          <div className="field">
            <label htmlFor="export-type">Export type</label>
            <select
              id="export-type"
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
            >
              {EXPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions" style={{ alignItems: "center" }}>
            <Button
              variant="primary"
              disabled={creating || !exportsEnabled}
              onClick={() => void createJob()}
            >
              {creating ? "Queueing…" : "Create export job"}
            </Button>
            <PlanLockBadge locked={!exportsEnabled} />
          </div>
        </Card>

        <Card loading={loading}>
          <CardTitle
            title="Recent jobs"
            subtitle={items.length ? `${items.length} listed` : "No jobs yet"}
            action={
              <Button onClick={() => void load()}>Refresh</Button>
            }
          />
          {!items.length ? (
            <EmptyState
              icon="ex"
              title="No export jobs"
              description="Create an export when your plan includes CSV exports. Free plans cannot queue jobs."
            />
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((job) => (
                    <tr key={job.id}>
                      <td>{job.exportType}</td>
                      <td>
                        <span className="ch">{job.status}</span>
                      </td>
                      <td className="mono">{formatWhen(job.createdAt)}</td>
                      <td>
                        {job.status === "COMPLETED" ? (
                          <Button
                            style={{ padding: "6px 10px" }}
                            onClick={() => void downloadJob(job)}
                          >
                            Download
                          </Button>
                        ) : job.errorCode ? (
                          <span className="m">{job.errorCode}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
