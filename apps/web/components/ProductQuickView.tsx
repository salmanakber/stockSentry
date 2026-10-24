"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IncidentSummaryBadge } from "./IncidentBadge";
import { ProductThumb } from "./ProductThumb";
import type { ProductItem } from "../lib/types";

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

interface ProductQuickViewProps {
  item: ProductItem | null;
  demo?: boolean;
  onClose: () => void;
}

export function ProductQuickView({
  item,
  demo = false,
  onClose,
}: ProductQuickViewProps) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const last = item.observations?.[0];
  const demoQs = demo ? "?demo=1" : "";
  const title = productTitle(item);

  return (
    <div
      className="pqv-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pqv-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pqv-card">
        <button
          type="button"
          className="pqv-x"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="pqv-hero">
          <ProductThumb src={item.imageUrl} label={title} size="lg" />
          <div className="pqv-hero-copy">
            <h2 id="pqv-title">{title}</h2>
            <p className="mono">
              {item.sku?.trim() ? `SKU ${item.sku}` : "No SKU"}
            </p>
            <IncidentSummaryBadge
              summary={item.incidentSummary}
              productId={item.id}
            />
          </div>
        </div>
        <dl className="pqv-grid">
          <div>
            <dt>Quantity</dt>
            <dd className="mono">
              {last?.quantity != null ? last.quantity : "—"}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{last?.location?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Last observed</dt>
            <dd>{formatWhen(last?.observedAt)}</dd>
          </div>
          <div>
            <dt>Tracked</dt>
            <dd>{item.tracked === false ? "No" : "Yes"}</dd>
          </div>
        </dl>
        <div className="pqv-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <Link
            href={`/products/${encodeURIComponent(item.id)}${demoQs}`}
            className="btn primary"
            onClick={onClose}
          >
            Open full detail
          </Link>
        </div>
      </div>
    </div>
  );
}
