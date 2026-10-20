"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type { ExportJob, ExportsListResponse } from "../../../lib/types";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ExportsListResponse>("/api/v1/exports", {
        shop,
      });
      setItems(res?.items ?? []);
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
    if (creating) return;
    setCreating(true);
    try {
      await apiRequest("/api/v1/exports", {
        method: "POST",
        shop,
        body: JSON.stringify({ exportType }),
      });
      showToast("Export job queued");
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
          <div className="form-actions">
            <Button
              variant="primary"
              disabled={creating}
              onClick={() => void createJob()}
            >
              {creating ? "Queueing…" : "Create export job"}
            </Button>
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
                        {job.resultUrl ? (
                          <a
                            href={job.resultUrl}
                            className="btn"
                            style={{ padding: "6px 10px" }}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
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
