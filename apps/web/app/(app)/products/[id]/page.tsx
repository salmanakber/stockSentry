"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "../../../../components/Button";
import { Card, CardTitle } from "../../../../components/Card";
import { useShell } from "../../../../components/AppShell";
import { useToast } from "../../../../components/Toast";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { PageHeader } from "../../../../components/shared/PageHeader";
import { apiRequest } from "../../../../lib/api";
import type { ProductDetailResponse } from "../../../../lib/types";
import { useShop } from "../../../../providers";
import { useReveal } from "../../../../hooks/useReveal";

function productTitle(item?: ProductDetailResponse["item"]): string {
  if (!item) return "Product";
  const base = item.productTitle?.trim() || "Untitled product";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

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

function sevChip(sev?: string): string {
  const s = String(sev ?? "").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "chip hot";
  if (s === "MEDIUM") return "chip";
  return "chip";
}

export default function ProductReportPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ProductDetailResponse>(
        `/api/v1/products/${encodeURIComponent(id)}?historyPage=${historyPage}`,
        { shop },
      );
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, shop, historyPage]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [data, ready, loading]);

  const generateReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/products/${encodeURIComponent(id)}/report`, {
        method: "POST",
        shop,
      });
      showToast("Product risk report queued");
      // poll briefly for completion
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        await load();
        const status = (await apiRequest<ProductDetailResponse>(
          `/api/v1/products/${encodeURIComponent(id)}`,
          { shop },
        ).catch(() => null))?.productReport?.status;
        if (status === "GENERATED" || status === "FAILED") break;
      }
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(false);
    }
  };

  const report = data?.productReport;
  const summary = (report?.summaryJson ?? null) as Record<
    string,
    unknown
  > | null;

  return (
    <div className="pg">
      <PageHeader
        title={productTitle(data?.item)}
        subtitle={
          data?.item?.sku ? (
            <span className="mono">SKU {data.item.sku}</span>
          ) : (
            "Product risk report"
          )
        }
        actions={
          <Link href="/products" className="btn">
            Back to products
          </Link>
        }
      />

      {loading && !data ? (
        <Card loading>
          <EmptyState
            icon="pr"
            title="Loading product"
            description="Fetching observations and incidents…"
          />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon="pr"
            title="Product not found"
            description="This inventory item is missing or deleted."
            action={
              <Link href="/products" className="btn p">
                Products
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="detail-grid">
          <div className="col2">
            <Card>
              <CardTitle
                title="Overview metrics"
                subtitle="30-day risk signals for this SKU"
              />
              <div className="facts" style={{ marginBottom: 0 }}>
                <div>
                  <small>Incidents (30d)</small>
                  <b>{data.stats?.incidentCount30d ?? 0}</b>
                </div>
                <div>
                  <small>Open</small>
                  <b>{data.stats?.openIncidentCount ?? 0}</b>
                </div>
                <div>
                  <small>Abs Δ qty (30d)</small>
                  <b>{data.stats?.absDeltaSum30d ?? 0}</b>
                </div>
                <div>
                  <small>Last change</small>
                  <b>{formatWhen(data.stats?.lastChangeAt)}</b>
                </div>
                <div>
                  <small>Monitoring</small>
                  <b>{data.stats?.monitoringHealth ?? "—"}</b>
                </div>
                <div>
                  <small>Tracked</small>
                  <b>{data.item.tracked === false ? "No" : "Yes"}</b>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle
                title="Quantity by location"
                subtitle="Latest observed available quantity"
              />
              {!data.locations?.length ? (
                <EmptyState
                  icon="pr"
                  title="No location data"
                  description="Quantities appear after baseline sync."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table" style={{ minWidth: 360 }}>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Qty</th>
                        <th>Observed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.locations.map((loc) => (
                        <tr key={loc.locationId}>
                          <td>{loc.name}</td>
                          <td className="mono">
                            {loc.quantity != null ? loc.quantity : "—"}
                          </td>
                          <td className="mono m">
                            {formatWhen(loc.lastObservedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardTitle
                title="Observation history"
                subtitle="Paginated quantity timeline"
              />
              {!data.history?.items?.length ? (
                <EmptyState
                  icon="hi"
                  title="No observations"
                  description="History fills after sync and webhooks."
                />
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table" style={{ minWidth: 420 }}>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Location</th>
                          <th>Qty</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.items.map((o) => (
                          <tr key={o.id}>
                            <td className="mono m">
                              {formatWhen(o.observedAt)}
                            </td>
                            <td>{o.location?.name ?? "—"}</td>
                            <td className="mono">{o.quantity}</td>
                            <td>
                              <span className="ch">{o.source}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="pager">
                    <span>
                      Page {data.history.page ?? 1} of{" "}
                      {data.history.totalPages ?? 1}
                    </span>
                    <div className="btns">
                      <Button
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        disabled={
                          historyPage >= (data.history.totalPages ?? 1)
                        }
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="col2">
            <Card>
              <CardTitle
                title="AI Product Report"
                subtitle="Risk summary from this product's evidence only"
                action={
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => void generateReport()}
                  >
                    {busy ? "Generating…" : "Generate"}
                  </Button>
                }
              />
              {report?.status ? (
                <span className="chip" style={{ marginBottom: 10 }}>
                  {report.status}
                </span>
              ) : null}
              {summary?.summary || summary?.why_flagged ? (
                <>
                  {typeof summary.title === "string" ? (
                    <h3 style={{ margin: "8px 0 6px", fontSize: 15 }}>
                      {summary.title}
                    </h3>
                  ) : null}
                  {typeof summary.summary === "string" ? (
                    <div className="ai-block">
                      <h3>Summary</h3>
                      <p>{summary.summary}</p>
                    </div>
                  ) : null}
                  {typeof summary.why_flagged === "string" ? (
                    <div className="ai-block">
                      <h3>Why flagged</h3>
                      <p>{summary.why_flagged}</p>
                    </div>
                  ) : null}
                  {Array.isArray(summary.recommended_checks) ? (
                    <div className="ai-block">
                      <h3>Recommended checks</h3>
                      <ul>
                        {(summary.recommended_checks as string[]).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon="zp"
                  title="No product report yet"
                  description="Generate a quota-aware AI summary using only this SKU's observations and incidents."
                />
              )}
            </Card>

            <Card>
              <CardTitle title="Incidents" subtitle="Open and recent for this SKU" />
              {!data.incidents?.open?.length &&
              !data.incidents?.recent?.length ? (
                <EmptyState
                  icon="in"
                  title="No incidents"
                  description="Detection has not opened incidents for this item."
                />
              ) : (
                <>
                  {(data.incidents.open?.length
                    ? data.incidents.open
                    : data.incidents.recent ?? []
                  ).map((inc) => (
                    <div className="list-row" key={inc.id}>
                      <div>
                        <b>
                          <Link
                            href={`/incidents/${encodeURIComponent(inc.id)}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                          >
                            {inc.type ?? "Incident"}
                          </Link>
                        </b>
                        <div className="m">
                          <span className={sevChip(inc.severity)}>
                            {inc.severity}
                          </span>{" "}
                          · {inc.status} · {inc.location?.name ?? "—"}
                        </div>
                      </div>
                      <div className="mono m">
                        {formatWhen(inc.lastDetectedAt)}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </Card>

            <Card>
              <CardTitle
                title="Bundle membership"
                subtitle="Groups that include this item"
              />
              {!data.bundles?.length ? (
                <EmptyState
                  icon="bu"
                  title="Not in a bundle"
                  description="Attach this SKU from Bundle Groups if it is a component."
                />
              ) : (
                data.bundles.map((b) => (
                  <div className="list-row" key={b.id}>
                    <div>
                      <b>
                        <Link
                          href="/bundles"
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {b.name}
                        </Link>
                      </b>
                      <div className="m">
                        {b.role ?? "COMPONENT"}
                        {b.active === false ? " · inactive" : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>

            <Card>
              <CardTitle title="Supplier" subtitle="Linked supply sources" />
              {!data.suppliers?.length ? (
                <EmptyState
                  icon="pr"
                  title="No supplier linked"
                  description="Attach a supplier from the Suppliers catalog."
                  action={
                    <Link href="/suppliers" className="btn">
                      Suppliers
                    </Link>
                  }
                />
              ) : (
                data.suppliers.map((s) => (
                  <div className="list-row" key={s.id}>
                    <div>
                      <b>
                        <Link
                          href={`/suppliers/${encodeURIComponent(s.id)}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {s.name}
                        </Link>
                      </b>
                      <div className="m">
                        {s.contactEmail ?? "No email"}
                        {s.leadTimeDays != null
                          ? ` · ${s.leadTimeDays}d lead`
                          : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
