"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { apiRequest } from "../../../lib/api";
import type {
  BillingStatusResponse,
  SupplierListItem,
  SuppliersListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

function initial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

export default function SuppliersPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<SupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [atLimit, setAtLimit] = useState(false);
  const [openReplenishment, setOpenReplenishment] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, bill, reqRes] = await Promise.all([
        apiRequest<SuppliersListResponse>("/api/v1/suppliers", { shop }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() => null),
        apiRequest<{ items?: Array<{ status?: string }> }>(
          "/api/v1/replenishment/requests",
          { shop },
        ).catch(() => ({ items: [] })),
      ]);
      const next = res?.items ?? [];
      setItems(next);
      const max = bill?.entitlements?.maxSuppliers;
      setAtLimit(typeof max === "number" && max >= 0 && next.length >= max);
      const open = (reqRes?.items ?? []).filter((r) => {
        const s = (r.status ?? "").toUpperCase();
        return (
          s === "PENDING_APPROVAL" ||
          s === "DRAFT" ||
          s === "QUEUED" ||
          s === "FAILED"
        );
      }).length;
      setOpenReplenishment(open);
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

  const stats = useMemo(() => {
    const verified = items.filter((s) => s.verified).length;
    const linked = items.reduce((sum, s) => sum + (s.itemCount ?? 0), 0);
    return {
      total: items.length,
      verified,
      linked,
      open: openReplenishment,
    };
  }, [items, openReplenishment]);

  const create = async () => {
    if (!name.trim() || creating || atLimit) return;
    setCreating(true);
    try {
      await apiRequest("/api/v1/suppliers", {
        method: "POST",
        shop,
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: email.trim() || undefined,
        }),
      });
      setName("");
      setEmail("");
      setModalOpen(false);
      showToast("Supplier created");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pg sup-studio">
      <header className="sup-hero">
        <p className="inv-eyebrow">Catalog</p>
        <h1>Suppliers</h1>
        <p>
          Link wholesale partners to products for risk context and optional
          replenishment emails — StockSentry never writes Shopify quantities.
        </p>
        <div className="sup-hero-actions">
          <Button
            variant="primary"
            disabled={atLimit}
            onClick={() => setModalOpen(true)}
          >
            Add supplier
          </Button>
          <PlanLockBadge locked={atLimit} />
          <Link href="/replenishment" className="btn">
            Replenishment
          </Link>
        </div>
      </header>

      <div className="sup-stats">
        <div className="sup-stat">
          <small>Suppliers</small>
          <b>{loading ? "—" : stats.total}</b>
        </div>
        <div className="sup-stat">
          <small>Verified</small>
          <b>{loading ? "—" : stats.verified}</b>
        </div>
        <div className="sup-stat">
          <small>Products linked</small>
          <b>{loading ? "—" : stats.linked}</b>
        </div>
        <div className="sup-stat">
          <small>Open replenishment</small>
          <b>{loading ? "—" : stats.open}</b>
        </div>
      </div>

      <Card loading={loading}>
        {!items.length ? (
          <div className="sup-empty">
            <EmptyState
              icon="db"
              title="No suppliers yet"
              description="Add a supplier to attach products and unlock optional restock emails when inventory runs low."
              action={
                <Button
                  variant="primary"
                  disabled={atLimit}
                  onClick={() => setModalOpen(true)}
                >
                  Add your first supplier
                </Button>
              }
            />
          </div>
        ) : (
          <div className="sup-grid">
            {items.map((s) => (
              <Link
                key={s.id}
                href={`/suppliers/${encodeURIComponent(s.id)}`}
                className="sup-card"
              >
                <div className="sup-card-top">
                  <div className="sup-av">{initial(s.name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{s.name}</b>
                    <span>
                      {s.contactEmail ?? s.contactName ?? "No contact yet"}
                    </span>
                  </div>
                  {s.verified ? (
                    <span className="chip on">Verified</span>
                  ) : (
                    <span className="chip">Unverified</span>
                  )}
                </div>
                <div className="sup-card-meta">
                  <span className="mono">{s.itemCount ?? 0} products</span>
                  {(s.openIncidentCount ?? 0) > 0 ? (
                    <span className="chip hot">
                      {s.openIncidentCount} open risk
                    </span>
                  ) : (
                    <span className="m">No open risk</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {modalOpen ? (
        <div
          className="sup-modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sup-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="sup-modal">
            <h2 id="sup-modal-title">Add supplier</h2>
            <p>Name and optional contact for replenishment emails.</p>
            <div className="field">
              <label htmlFor="sup-name">Name</label>
              <input
                id="sup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Wholesale"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="sup-email">Contact email</label>
              <input
                id="sup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@supplier.com"
              />
            </div>
            <div className="form-actions">
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={creating || !name.trim() || atLimit}
                onClick={() => void create()}
              >
                {creating ? "Saving…" : "Create supplier"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
