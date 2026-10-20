"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { Icon } from "../../../components/IconSprite";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type { ProductItem, ProductsListResponse } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

function productTitle(item: ProductItem): string {
  const base = item.productTitle?.trim() || "Untitled product";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

export default function ProductsPage() {
  const { shop } = useShop();
  const { ready, setCardLoading } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<ProductItem[]>([]);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; active?: boolean }>
  >([]);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      const res = await apiRequest<ProductsListResponse>(
        `/api/v1/products?${params}`,
        { shop },
      );
      setItems(res?.items ?? []);
      setLocations(res?.locations ?? []);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
      setTotal(res?.total ?? 0);
    } catch {
      setItems([]);
      setLocations([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, locations, ready, loading]);

  const onSync = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setCardLoading(true);
    try {
      await apiRequest("/api/v1/sync", {
        method: "POST",
        shop,
        forceAuthRefresh: true,
      });
      showToast("Sync enqueued — baseline and reconcile jobs queued");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncBusy(false);
      setCardLoading(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Products & Locations"
        subtitle="Catalog items and locations under inventory monitoring."
        actions={
          <Button
            variant="primary"
            onClick={() => void onSync()}
            disabled={syncBusy}
          >
            <Icon id="rf" className={`i${syncBusy ? " spin" : ""}`} />
            {syncBusy ? "Syncing…" : "Sync now"}
          </Button>
        }
      />

      <div className="split">
        <Card loading={loading}>
          <CardTitle
            title="Inventory items"
            subtitle={total ? `${total.toLocaleString()} tracked` : "Catalog sync"}
          />
          <div className="filters">
            <input
              type="search"
              placeholder="Search title or SKU…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setQ(qInput.trim());
                }
              }}
              aria-label="Search products"
            />
            <Button
              onClick={() => {
                setPage(1);
                setQ(qInput.trim());
              }}
            >
              Search
            </Button>
          </div>

          {!items.length ? (
            <EmptyState
              icon="pr"
              title="No products loaded"
              description="Products and locations sync from Shopify after install. Nothing is listed until the first catalog sync completes."
              action={
                <Button variant="primary" onClick={() => void onSync()}>
                  Sync now
                </Button>
              }
            />
          ) : (
            <>
              {items.map((item) => {
                const last = item.observations?.[0];
                return (
                  <div className="list-row" key={item.id}>
                    <div>
                      <b>{productTitle(item)}</b>
                      <div className="m mono">
                        {item.sku ? `SKU ${item.sku}` : "No SKU"}
                        {last?.location?.name
                          ? ` · ${last.location.name}`
                          : ""}
                      </div>
                    </div>
                    <div className="q" style={{ textAlign: "right" }}>
                      {last?.quantity != null ? last.quantity : "—"}
                      {last?.location?.name ? (
                        <small>{last.location.name}</small>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
          )}
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
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
