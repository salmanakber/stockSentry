"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardTitle } from "../../../../components/Card";
import { PageHeader } from "../../../../components/shared/PageHeader";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { Button } from "../../../../components/Button";
import { apiRequest } from "../../../../lib/api";
import { DEMO_INCIDENTS } from "../../../../lib/demo-data";
import type { IncidentDetailResponse } from "../../../../lib/types";
import {
  severityLabel,
  statusColor,
  statusLabel,
} from "../../../../lib/format";
import { useShop } from "../../../../providers";
import { useReveal } from "../../../../hooks/useReveal";
import { useShell } from "../../../../components/AppShell";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const { ready } = useShell();
  const [data, setData] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (demo) {
      const found = DEMO_INCIDENTS.find((i) => i.id === id) ?? null;
      setData(found);
      if (!found) setError("Incident not found in demo data.");
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<IncidentDetailResponse>(
        `/api/v1/incidents/${encodeURIComponent(id)}`,
        { shop },
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [demo, id, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [data, ready, loading]);

  return (
    <div className="pg">
      <PageHeader
        title={data?.title ?? "Incident"}
        subtitle={
          data ? (
            <>
              <span className="mono">{data.id}</span> · {data.subtitle}
            </>
          ) : (
            id
          )
        }
        actions={
          <Link href="/incidents" className="btn">
            Back to incidents
          </Link>
        }
      />

      {loading ? (
        <Card loading>
          <EmptyState
            icon="in"
            title="Loading incident"
            description="Fetching evidence and status…"
          />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon="in"
            title="Incident unavailable"
            description={error ?? "This incident could not be loaded."}
            action={
              <Button onClick={() => void load()}>Try again</Button>
            }
          />
        </Card>
      ) : (
        <div className="detail-grid">
          <div className="col2">
            <Card>
              <CardTitle title="Summary" subtitle="Observed change details" />
              <div className="facts" style={{ marginBottom: 0 }}>
                <div>
                  <small>Severity</small>
                  <b>{data.severityLabel ?? severityLabel(data.severity)}</b>
                </div>
                <div>
                  <small>Status</small>
                  <b>
                    <span className="st">
                      <i
                        style={{
                          background:
                            data.statusColor ?? statusColor(data.status),
                        }}
                      />
                      {statusLabel(data.status)}
                    </span>
                  </b>
                </div>
                <div>
                  <small>Detected</small>
                  <b>{data.detectedAt}</b>
                </div>
              </div>
              <div className="rw" style={{ marginTop: 16 }}>
                <span>Quantity</span>
                <b>
                  {data.quantity}
                  {data.quantityDelta ? ` · ${data.quantityDelta}` : ""}
                </b>
              </div>
              <div className="rw">
                <span>Rule</span>
                <b>
                  {data.rule}
                  {data.ruleDetail ? ` (${data.ruleDetail})` : ""}
                </b>
              </div>
              <div className="rw">
                <span>Source</span>
                <b className="ch">{data.source}</b>
              </div>
            </Card>

            <Card>
              <CardTitle
                title="Evidence"
                subtitle="Confirmed facts, unknowns, and suggested checks"
              />
              <div className="evi" style={{ padding: 0, background: "transparent" }}>
                <div className="c">
                  <em>Confirmed</em>
                  <p>{data.evidence?.confirmed ?? "—"}</p>
                </div>
                <div className="u">
                  <em>Unknown</em>
                  <p>{data.evidence?.unknown ?? "—"}</p>
                </div>
                <div className="n">
                  <em>Suggested check</em>
                  <p>{data.evidence?.suggested ?? "—"}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="col2">
            <Card>
              <CardTitle
                title="AI report"
                subtitle="Explains evidence; never the source of truth"
              />
              {data.aiReport?.summary ? (
                <p style={{ margin: 0, color: "#475467", fontSize: 13.5 }}>
                  {data.aiReport.summary}
                </p>
              ) : (
                <EmptyState
                  icon="zp"
                  title="No AI report"
                  description="A report will appear when this incident is eligible and generation succeeds."
                />
              )}
            </Card>
            <Card>
              <CardTitle title="Activity" subtitle="Status changes and notes" />
              {data.activity?.length || data.notes?.length ? (
                <>
                  {(data.activity ?? []).map((a, i) => (
                    <div className="rw" key={`a-${i}`}>
                      <span>{a.text}</span>
                      <small className="mono" style={{ color: "var(--mut)" }}>
                        {a.at}
                      </small>
                    </div>
                  ))}
                  {(data.notes ?? []).map((n, i) => (
                    <div className="rw" key={`n-${i}`}>
                      <span>
                        <b>{n.author}</b> — {n.text}
                      </span>
                      <small className="mono" style={{ color: "var(--mut)" }}>
                        {n.at}
                      </small>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState
                  icon="hi"
                  title="No activity yet"
                  description="Reviews, status changes, and notes will list here."
                />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
