"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardTitle } from "../../../../components/Card";
import { PageHeader } from "../../../../components/shared/PageHeader";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { Button } from "../../../../components/Button";
import { useToast } from "../../../../components/Toast";
import { apiRequest } from "../../../../lib/api";
import { DEMO_INCIDENTS } from "../../../../lib/demo-data";
import {
  mapApiIncidentDetail,
  toApiStatus,
  type ApiIncident,
} from "../../../../lib/map-incident";
import type { IncidentDetailResponse } from "../../../../lib/types";
import {
  severityLabel,
  statusColor,
  statusLabel,
} from "../../../../lib/format";
import { useShop } from "../../../../providers";
import { useReveal } from "../../../../hooks/useReveal";
import { useShell } from "../../../../components/AppShell";

function FactList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="ai-block">
      <h3>{title}</h3>
      <ul>
        {items.map((line, i) => (
          <li key={`${title}-${i}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const { ready } = useShell();
  const { showToast } = useToast();
  const [data, setData] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

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
      const res = await apiRequest<ApiIncident>(
        `/api/v1/incidents/${encodeURIComponent(id)}`,
        { shop },
      );
      setData(mapApiIncidentDetail(res));
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

  const patchStatus = async (
    status: "investigating" | "resolved" | "dismissed",
  ) => {
    if (demo) {
      showToast("Status changes are disabled in demo mode");
      return;
    }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiRequest(`/api/v1/incidents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        shop,
        body: JSON.stringify({ status: toApiStatus(status) }),
      });
      showToast(`Status set to ${statusLabel(status)}`);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setActionBusy(false);
    }
  };

  const addNote = async () => {
    if (demo) {
      showToast("Notes are disabled in demo mode");
      return;
    }
    const content = note.trim();
    if (!content || actionBusy) return;
    setActionBusy(true);
    try {
      await apiRequest(`/api/v1/incidents/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        shop,
        body: JSON.stringify({ content }),
      });
      setNote("");
      showToast("Note added");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not add note");
    } finally {
      setActionBusy(false);
    }
  };

  const generateAi = async () => {
    if (demo) {
      showToast("AI reports are disabled in demo mode");
      return;
    }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiRequest(
        `/api/v1/incidents/${encodeURIComponent(id)}/ai-report`,
        { method: "POST", shop },
      );
      showToast("AI report queued");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "AI report failed");
    } finally {
      setActionBusy(false);
    }
  };

  const report = data?.aiReport;

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
            action={<Button onClick={() => void load()}>Try again</Button>}
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

              <CardTitle
                title="Actions"
                subtitle="Update review status"
              />
              <div className="form-actions">
                <Button
                  disabled={actionBusy}
                  onClick={() => void patchStatus("investigating")}
                >
                  Investigating
                </Button>
                <Button
                  variant="primary"
                  disabled={actionBusy}
                  onClick={() => void patchStatus("resolved")}
                >
                  Resolve
                </Button>
                <Button
                  disabled={actionBusy}
                  onClick={() => void patchStatus("dismissed")}
                >
                  Dismiss
                </Button>
              </div>
            </Card>

            <Card>
              <CardTitle
                title="Evidence"
                subtitle="Confirmed facts, unknowns, and suggested checks"
              />
              <div
                className="evi"
                style={{ padding: 0, background: "transparent" }}
              >
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

            <Card>
              <CardTitle title="Add note" subtitle="Merchant review notes" />
              <div className="field">
                <label htmlFor="inc-note">Note</label>
                <textarea
                  id="inc-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you check?"
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={actionBusy || !note.trim()}
                  onClick={() => void addNote()}
                >
                  Add note
                </Button>
              </div>
            </Card>
          </div>

          <div className="col2">
            <Card>
              <CardTitle
                title="AI report"
                subtitle="Explains evidence; never the source of truth"
                action={
                  <Button disabled={actionBusy} onClick={() => void generateAi()}>
                    Generate
                  </Button>
                }
              />
              {report?.summary || report?.why_flagged ? (
                <>
                  {report.status ? (
                    <span className="chip">{report.status}</span>
                  ) : null}
                  {report.title ? (
                    <h3 style={{ margin: "10px 0 6px", fontSize: 15 }}>
                      {report.title}
                    </h3>
                  ) : null}
                  {report.summary ? (
                    <div className="ai-block">
                      <h3>Summary</h3>
                      <p>{report.summary}</p>
                    </div>
                  ) : null}
                  {report.why_flagged ? (
                    <div className="ai-block">
                      <h3>Why flagged</h3>
                      <p>{report.why_flagged}</p>
                    </div>
                  ) : null}
                  <FactList
                    title="Confirmed facts"
                    items={report.confirmed_facts}
                  />
                  <FactList
                    title="Possible explanations"
                    items={report.possible_explanations}
                  />
                  <FactList
                    title="Recommended checks"
                    items={report.recommended_checks}
                  />
                  <FactList title="Unknowns" items={report.unknowns} />
                  {report.confidence_note ? (
                    <div className="ai-block">
                      <h3>Confidence note</h3>
                      <p>{report.confidence_note}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon="zp"
                  title="No AI report"
                  description="Generate a report when this incident is eligible. Reports explain evidence only."
                  action={
                    <Button
                      variant="primary"
                      disabled={actionBusy}
                      onClick={() => void generateAi()}
                    >
                      Generate AI report
                    </Button>
                  }
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
