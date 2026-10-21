"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "./Button";
import { IncidentSummaryBadge } from "./IncidentBadge";
import { EmptyState } from "./shared/EmptyState";
import { apiRequest } from "../lib/api";
import { DEMO_PRODUCTS } from "../lib/demo-data";
import type { ProductItem, ProductsListResponse } from "../lib/types";
import { useShop } from "../providers";

const PAGE_SIZE = 50;

function productLabel(item: ProductItem): string {
  const base = item.productTitle?.trim() || "Untitled product";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

function chipLabel(item: ProductItem): string {
  const base = item.productTitle?.trim() || "Untitled";
  if (item.sku) return `${base} (${item.sku})`;
  return base;
}

function latestQty(item: ProductItem): number | null {
  const q = item.observations?.[0]?.quantity;
  return typeof q === "number" ? q : null;
}

export interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: ProductItem[]) => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
  /** Already attached / excluded from selection */
  excludeIds?: Iterable<string>;
  /** Pre-check these ids when opening */
  initialSelectedIds?: Iterable<string>;
}

export function ProductPickerModal({
  open,
  onClose,
  onConfirm,
  title = "Select products",
  confirmLabel = "Confirm",
  excludeIds,
  initialSelectedIds,
}: ProductPickerModalProps) {
  const { shop } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";

  const excluded = useMemo(
    () => new Set(excludeIds ? [...excludeIds] : []),
    [excludeIds],
  );

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectedMap, setSelectedMap] = useState<Map<string, ProductItem>>(
    () => new Map(),
  );
  const [confirming, setConfirming] = useState(false);

  // Reset selection when opened
  useEffect(() => {
    if (!open) return;
    const init = new Set(initialSelectedIds ? [...initialSelectedIds] : []);
    setSelectedIds(init);
    setSelectedMap(new Map());
    setQInput("");
    setQ("");
    setPage(1);
    setError(null);
  }, [open, initialSelectedIds]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      if (demo) {
        const needle = q.trim().toLowerCase();
        const filtered = DEMO_PRODUCTS.filter((p) => {
          if (excluded.has(p.id)) return false;
          if (!needle) return true;
          const hay = [
            p.productTitle,
            p.variantTitle,
            p.sku,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        });
        const start = (page - 1) * PAGE_SIZE;
        const slice = filtered.slice(start, start + PAGE_SIZE);
        setItems(slice);
        setTotal(filtered.length);
        setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
        return;
      }

      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      const res = await apiRequest<ProductsListResponse>(
        `/api/v1/products?${params}`,
        { shop },
      );
      const next = (res?.items ?? []).filter((p) => !excluded.has(p.id));
      setItems(next);
      setTotal(res?.total ?? next.length);
      setTotalPages(Math.max(1, res?.totalPages ?? 1));
    } catch (e) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [demo, excluded, open, page, q, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep selectedMap labels fresh when items load
  useEffect(() => {
    if (!items.length || !selectedIds.size) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        if (selectedIds.has(item.id)) next.set(item.id, item);
      }
      return next;
    });
  }, [items, selectedIds]);

  const toggle = (item: ProductItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const removeChip = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const onSearch = (e?: FormEvent) => {
    e?.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  const handleConfirm = async () => {
    if (confirming || !selectedIds.size) return;
    setConfirming(true);
    try {
      const selected = [...selectedIds].map(
        (id) =>
          selectedMap.get(id) ??
          items.find((i) => i.id === id) ??
          ({ id } as ProductItem),
      );
      await onConfirm(selected);
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  if (!open) return null;

  const chips = [...selectedIds]
    .map((id) => selectedMap.get(id) ?? items.find((i) => i.id === id))
    .filter(Boolean) as ProductItem[];

  return (
    <div
      className="ppm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ppm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ppm-title"
      >
        <header className="ppm-head">
          <div>
            <h2 id="ppm-title">{title}</h2>
            <p className="m">
              {selectedIds.size
                ? `${selectedIds.size} selected`
                : "Search and select inventory items"}
            </p>
          </div>
          <button
            type="button"
            className="ppm-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="ppm-search" onSubmit={onSearch}>
          <input
            type="search"
            placeholder="Search title or SKU…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            aria-label="Search products"
            autoFocus
          />
          <Button type="submit">Search</Button>
        </form>

        {chips.length ? (
          <div className="ppm-chips chip-row">
            {chips.map((c) => (
              <span className="chip" key={c.id}>
                {chipLabel(c)}
                <button
                  type="button"
                  aria-label={`Remove ${chipLabel(c)}`}
                  onClick={() => removeChip(c.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="ppm-body">
          {loading ? (
            <EmptyState
              icon="pr"
              title="Loading products…"
              description="Fetching catalog items."
            />
          ) : error ? (
            <EmptyState
              icon="pr"
              title="Couldn’t load products"
              description={error}
              action={<Button onClick={() => void load()}>Retry</Button>}
            />
          ) : !items.length ? (
            <EmptyState
              icon="pr"
              title={q ? "No matches" : "No products"}
              description={
                q
                  ? "Try a different search term."
                  : "Sync inventory from Shopify to populate this list."
              }
            />
          ) : (
            <ul className="ppm-list">
              {items.map((item) => {
                const checked = selectedIds.has(item.id);
                const qty = latestQty(item);
                return (
                  <li key={item.id}>
                    <label className={`ppm-row${checked ? " on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item)}
                      />
                      <div className="ppm-row-main">
                        <b>{productLabel(item)}</b>
                        <div className="m mono">
                          {item.sku ? `SKU ${item.sku}` : "No SKU"}
                          {qty != null ? ` · qty ${qty}` : ""}
                          {item.observations?.[0]?.location?.name
                            ? ` · ${item.observations[0].location.name}`
                            : ""}
                        </div>
                        <IncidentSummaryBadge
                          summary={item.incidentSummary}
                          productId={item.id}
                        />
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="ppm-foot">
          <span className="m">
            {total
              ? `${total.toLocaleString()} in catalog · page ${page} of ${totalPages}`
              : "—"}
          </span>
          <div className="btns">
            <Button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!selectedIds.size || confirming}
              onClick={() => void handleConfirm()}
            >
              {confirming
                ? "Saving…"
                : `${confirmLabel}${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
