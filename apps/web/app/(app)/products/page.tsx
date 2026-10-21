"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { Icon } from "../../../components/IconSprite";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { IncidentSummaryBadge } from "../../../components/IncidentBadge";
import { apiRequest } from "../../../lib/api";
import {
  DEMO_PRODUCTS_STATS,
  filterDemoProducts,
} from "../../../lib/demo-data";
import type {
  ProductItem,
  ProductsListResponse,
  ProductsStatsResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

function productTitle(item: ProductItem): string {
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

export default function ProductsPage() {
  const { shop } = useShop();
  const { ready, setCardLoading } = useShell();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";

  const [items, setItems] = useState<ProductItem[]>([]);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; active?: boolean }>
  >([]);
  const [stats, setStats] = useState<ProductsStatsResponse | null>(null);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [locationId, setLocationId] = useState("");
  const [hasOpenIncident, setHasOpenIncident] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      if (demo) {
        setStats(DEMO_PRODUCTS_STATS);
        return;
      }
      const res = await apiRequest<ProductsStatsResponse>(
        "/api/v1/products/stats",
        { shop },
      );
      setStats(res);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [demo, shop]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (demo) {
        const res = filterDemoProducts({
          q,
          locationId: locationId || undefined,
          hasOpenIncident: hasOpenIncident || undefined,
          page,
        });
        setItems(res.items);
        setLocations(res.locations);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        return;
      }

      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      if (locationId) params.set("locationId", locationId);
      if (hasOpenIncident) params.set("hasOpenIncident", "1");
      const res = await apiRequest<ProductsListResponse>(
        `/api/v1/products?${params}`,
        { shop },
      );
      setItems(res?.items ?? []);
      setLocations(res?.locations ?? []);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
      setTotal(res?.total ?? 0);
    } catch (e) {
      setItems([]);
      setLocations([]);
      setTotalPages(1);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [demo, hasOpenIncident, locationId, page, q, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useReveal(ready && !loading, null, [items, locations, ready, loading]);

  const onSync = async () => {
    if (syncBusy || demo) {
      if (demo) showToast("Sync is unavailable in demo mode");
      return;
    }
    setSyncBusy(true);
    setCardLoading(true);
    try {
      await apiRequest("/api/v1/sync", {
        method: "POST",
        shop,
        forceAuthRefresh: true,
      });
      showToast("Inventory sync started");
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncBusy(false);
      setCardLoading(false);
    }
  };

  const applySearch = () => {
    setPage(1);
    setQ(qInput.trim());
  };

  const demoQs = demo ? "?demo=1" : "";

  return (
    <div className="pg inventory-pg">
      <PageHeader
        title="Inventory"
        subtitle="Monitored products, quantities, and locations from Shopify."
        actions={
          <>
            <Link href={`/exports${demoQs}`} className="btn">
              CSV export
            </Link>
            <Button
              variant="primary"
              onClick={() => void onSync()}
              disabled={syncBusy || demo}
            >
              <Icon id="rf" className={`i${syncBusy ? " spin" : ""}`} />
              {syncBusy ? "Syncing…" : "Sync now"}
            </Button>
          </>
        }
      />

      <section className="inv-stats">
        <Card loading={statsLoading} className="inv-stat">
          <div className="inv-stat-label">Monitored items</div>
          <div className="inv-stat-value">
            {stats?.monitoredCount != null
              ? stats.monitoredCount.toLocaleString()
              : "—"}
          </div>
          <div className="inv-stat-sub m">
            {stats?.locationCount != null
              ? `Across ${stats.locationCount} location${stats.locationCount === 1 ? "" : "s"}`
              : "From catalog sync"}
          </div>
        </Card>
        <Card loading={statsLoading} className="inv-stat">
          <div className="inv-stat-label">Open incidents</div>
          <div className="inv-stat-value hot">
            {stats?.openIncidentProductCount != null
              ? stats.openIncidentProductCount.toLocaleString()
              : "—"}
          </div>
          <div className="inv-stat-sub m">Products with open flags</div>
        </Card>
        <Card loading={statsLoading} className="inv-stat">
          <div className="inv-stat-label">Last verified</div>
          <div className="inv-stat-value sm">
            {formatWhen(stats?.lastVerifiedAt)}
          </div>
          <div className="inv-stat-sub m">
            Inventory verification run
          </div>
        </Card>
      </section>

      <div className="split">
        <Card loading={loading}>
          <CardTitle
            title="Products"
            subtitle={
              total
                ? `${total.toLocaleString()} matching`
                : "Catalog under monitoring"
            }
          />
          <div className="filters inv-filters">
            <input
              type="search"
              placeholder="Search title or SKU…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              aria-label="Search products"
            />
            <select
              aria-label="Filter by location"
              value={locationId}
              onChange={(e) => {
                setPage(1);
                setLocationId(e.target.value);
              }}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <label className="field-check inv-check">
              <input
                type="checkbox"
                checked={hasOpenIncident}
                onChange={(e) => {
                  setPage(1);
                  setHasOpenIncident(e.target.checked);
                }}
              />
              Open incidents only
            </label>
            <Button onClick={applySearch}>Search</Button>
          </div>

          {error ? (
            <EmptyState
              icon="pr"
              title="Couldn’t load inventory"
              description={error}
              action={
                <Button variant="primary" onClick={() => void load()}>
                  Retry
                </Button>
              }
            />
          ) : !items.length && !loading ? (
            <EmptyState
              icon="pr"
              title={q || locationId || hasOpenIncident ? "No matches" : "No products loaded"}
              description={
                q || locationId || hasOpenIncident
                  ? "Try clearing filters or searching a different term."
                  : "Products and locations sync from Shopify after install. Nothing is listed until the first catalog sync completes."
              }
              action={
                !q && !locationId && !hasOpenIncident && !demo ? (
                  <Button variant="primary" onClick={() => void onSync()}>
                    Sync now
                  </Button>
                ) : undefined
              }
            />
          ) : items.length ? (
            <>
              <div className="table-wrap">
                <table className="table inv-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Location</th>
                      <th>Last observed</th>
                      <th>Incidents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const last = item.observations?.[0];
                      return (
                        <tr key={item.id}>
                          <td>
                            <Link
                              href={`/products/${encodeURIComponent(item.id)}${demoQs}`}
                              className="inv-name"
                            >
                              {productTitle(item)}
                            </Link>
                          </td>
                          <td className="mono">
                            {item.sku?.trim() ? item.sku : "—"}
                          </td>
                          <td className="mono">
                            {last?.quantity != null ? last.quantity : "—"}
                          </td>
                          <td>{last?.location?.name ?? "—"}</td>
                          <td className="m">{formatWhen(last?.observedAt)}</td>
                          <td>
                            <IncidentSummaryBadge
                              summary={item.incidentSummary}
                              productId={item.id}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pager">
                <span>
                  Page {page} of {totalPages}
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
          ) : null}
        </Card>

        <Card loading={loading}>
          <CardTitle
            title="Locations"
            subtitle="Active Shopify locations for this shop"
          />
          {!locations.length ? (
            <EmptyState
              icon="pr"
              title="No locations yet"
              description="Locations appear after the first inventory sync."
            />
          ) : (
            locations.map((loc) => (
              <div className="list-row" key={loc.id}>
                <div>
                  <b>{loc.name}</b>
                  <div className="m">
                    {loc.active === false ? "Inactive" : "Active"}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setPage(1);
                    setLocationId(loc.id);
                  }}
                >
                  Filter
                </Button>
              </div>
            ))
          )}
          <p className="m" style={{ marginTop: 16, marginBottom: 0 }}>
            Need a CSV of history?{" "}
            <Link href={`/exports${demoQs}`}>Open Reports / Exports</Link> or{" "}
            <Link href={`/history${demoQs}`}>Inventory History</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
