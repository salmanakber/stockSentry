"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./IconSprite";
import { apiRequest } from "../lib/api";
import type { ProductItem, ProductsListResponse } from "../lib/types";
import { useShop } from "../providers";

type SearchIncident = {
  id: string;
  type?: string;
  ruleType?: string | null;
  severity?: string;
  status?: string;
  inventoryItem?: {
    productTitle?: string | null;
    sku?: string | null;
  } | null;
};

function productLabel(item: ProductItem): string {
  const base = item.productTitle?.trim() || "Untitled product";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

function incidentLabel(inc: SearchIncident): string {
  const product = inc.inventoryItem?.productTitle?.trim();
  const type = inc.type || inc.ruleType || "Incident";
  return product ? `${type} · ${product}` : type;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  demo?: boolean;
}

export function GlobalSearch({ open, onClose, demo = false }: GlobalSearchProps) {
  const { shop } = useShop();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [incidents, setIncidents] = useState<SearchIncident[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setProducts([]);
    setIncidents([]);
    setSearched(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 1) {
      setProducts([]);
      setIncidents([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          if (demo) {
            if (!cancelled) {
              setProducts([]);
              setIncidents([]);
              setSearched(true);
            }
            return;
          }
          const params = new URLSearchParams({ q: term, page: "1" });
          const [prodRes, incRes] = await Promise.all([
            apiRequest<ProductsListResponse>(
              `/api/v1/products?${params}&limit=8`,
              { shop },
            ).catch(() => ({ items: [] as ProductItem[] })),
            apiRequest<{ items?: SearchIncident[] }>(
              `/api/v1/incidents?${params}`,
              { shop },
            ).catch(() => ({ items: [] as SearchIncident[] })),
          ]);
          if (cancelled) return;
          setProducts((prodRes.items ?? []).slice(0, 8));
          setIncidents((incRes.items ?? []).slice(0, 8));
          setSearched(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, open, shop, demo]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  if (!open) return null;

  const empty =
    searched && !loading && products.length === 0 && incidents.length === 0;

  return (
    <div
      className="gs-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gs-modal">
        <div className="gs-head">
          <Icon id="sc" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, incidents…"
            aria-label="Global search"
          />
          <kbd>Esc</kbd>
        </div>
        <h2 id={titleId} className="sr-only">
          Search
        </h2>
        <div className="gs-body">
          {loading ? (
            <p className="gs-status">Searching…</p>
          ) : !q.trim() ? (
            <p className="gs-status">
              Type to search products and incidents. Press Esc to close.
            </p>
          ) : empty ? (
            <p className="gs-status">No results for “{q.trim()}”.</p>
          ) : (
            <>
              {products.length ? (
                <section className="gs-group">
                  <h3>Products</h3>
                  <ul>
                    {products.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() =>
                            go(`/products/${encodeURIComponent(p.id)}`)
                          }
                        >
                          <span className="gs-title">{productLabel(p)}</span>
                          <span className="gs-meta mono">
                            {p.sku?.trim() || "No SKU"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {incidents.length ? (
                <section className="gs-group">
                  <h3>Incidents</h3>
                  <ul>
                    {incidents.map((inc) => (
                      <li key={inc.id}>
                        <button
                          type="button"
                          onClick={() =>
                            go(`/incidents/${encodeURIComponent(inc.id)}`)
                          }
                        >
                          <span className="gs-title">
                            {incidentLabel(inc)}
                          </span>
                          <span className="gs-meta">
                            {[inc.severity, inc.status]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
