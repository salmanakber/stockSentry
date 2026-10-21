"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { IncidentSummaryBadge } from "../../../components/IncidentBadge";
import { apiRequest } from "../../../lib/api";
import type {
  BundleGroup,
  BundlesListResponse,
  ProductItem,
  ProductsListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const ROLES = ["COMPONENT", "BUNDLE", "SHARED"] as const;

function itemLabel(item?: {
  productTitle?: string | null;
  variantTitle?: string | null;
  sku?: string | null;
}): string {
  if (!item) return "Item";
  const base = item.productTitle?.trim() || "Untitled";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return item.sku ? `${base} (${item.sku})` : base;
}

export default function BundlesPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [groups, setGroups] = useState<BundleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<ProductItem[]>([]);
  const [role, setRole] = useState<(typeof ROLES)[number]>("COMPONENT");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<BundlesListResponse>("/api/v1/bundles", {
        shop,
      });
      const next = res?.items ?? [];
      setGroups(next);
      setSelectedId((prev) => {
        if (prev && next.some((g) => g.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  );

  useEffect(() => {
    const g = groups.find((x) => x.id === selectedId);
    if (!g) {
      setEditName("");
      setEditNotes("");
      return;
    }
    setEditName(g.name);
    setEditNotes(g.description ?? "");
    // Only re-sync form when selection changes, not on every groups refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useReveal(ready && !loading, null, [groups, ready, loading, selectedId]);

  const createGroup = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const created = await apiRequest<BundleGroup>("/api/v1/bundles", {
        method: "POST",
        shop,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      setName("");
      setDescription("");
      showToast("Bundle group created");
      await load();
      if (created?.id) setSelectedId(created.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const saveMeta = async () => {
    if (!selected || savingMeta) return;
    setSavingMeta(true);
    try {
      await apiRequest(`/api/v1/bundles/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        shop,
        body: JSON.stringify({
          name: editName.trim(),
          description: editNotes.trim() || null,
        }),
      });
      showToast("Group updated");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingMeta(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await apiRequest(`/api/v1/bundles/${encodeURIComponent(id)}`, {
        method: "DELETE",
        shop,
      });
      if (selectedId === id) setSelectedId(null);
      showToast("Bundle group deleted");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const searchProducts = async () => {
    const q = searchQ.trim();
    if (!q) {
      setHits([]);
      return;
    }
    try {
      const res = await apiRequest<ProductsListResponse>(
        `/api/v1/products?q=${encodeURIComponent(q)}&page=1`,
        { shop },
      );
      setHits(res?.items ?? []);
    } catch {
      setHits([]);
    }
  };

  const addItem = async (inventoryItemId: string) => {
    if (!selectedId) {
      showToast("Select a bundle group first");
      return;
    }
    setBusyId(inventoryItemId);
    try {
      await apiRequest(
        `/api/v1/bundles/${encodeURIComponent(selectedId)}/items`,
        {
          method: "POST",
          shop,
          body: JSON.stringify({ inventoryItemId, role }),
        },
      );
      showToast("Item added to group");
      setHits([]);
      setSearchQ("");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Add item failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (groupId: string, itemId: string) => {
    setBusyId(itemId);
    try {
      await apiRequest(
        `/api/v1/bundles/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE", shop },
      );
      showToast("Item removed");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pg bundle-studio">
      <PageHeader
        title="Bundle Groups"
        subtitle="Map gift sets and kits to components — alerts only, never writes Shopify qty."
      />

      <Card className="bundle-how">
        <CardTitle title="How it works" />
        <p className="m" style={{ margin: 0 }}>
          Create a group for a gift set or kit. Add the individual products that
          make up the bundle. When a component has an open inventory incident or
          low stock, StockSentry highlights the group so you can investigate
          before the bundle oversells. StockSentry does not change Shopify
          quantities.
        </p>
      </Card>

      <div className="bundle-studio-layout">
        <aside className="bundle-studio-list">
          <Card loading={loading}>
            <CardTitle
              title="Groups"
              subtitle={
                groups.length
                  ? `${groups.length} group${groups.length === 1 ? "" : "s"}`
                  : "No groups yet"
              }
            />

            <div className="bundle-create">
              <div className="field">
                <label htmlFor="bg-name">New group name</label>
                <input
                  id="bg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Gift set"
                />
              </div>
              <div className="field">
                <label htmlFor="bg-desc">Notes</label>
                <textarea
                  id="bg-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
              <Button
                variant="primary"
                disabled={!name.trim() || creating}
                onClick={() => void createGroup()}
              >
                {creating ? "Creating…" : "Create group"}
              </Button>
            </div>

            {!groups.length && !loading ? (
              <EmptyState
                icon="bu"
                title="No bundle groups"
                description="Create a group for a kit or gift set, then add the products that make it up."
              />
            ) : (
              <ul className="bundle-group-nav">
                {groups.map((g) => {
                  const count = g.items?.length ?? 0;
                  const hot =
                    Boolean(g.hasOpenIncidents) || Boolean(g.hasRefillRisk);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        className={`bundle-nav-item${selectedId === g.id ? " on" : ""}${hot ? " hot" : ""}`}
                        onClick={() => setSelectedId(g.id)}
                      >
                        <span className="bn-name">{g.name}</span>
                        <span className="bn-meta">
                          {count} component{count === 1 ? "" : "s"}
                          {g.openComponentCount
                            ? ` · ${g.openComponentCount} open`
                            : ""}
                          {g.hasRefillRisk ? " · refill" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>

        <div className="bundle-studio-detail">
          {!selected ? (
            <Card>
              <EmptyState
                icon="bu"
                title="Select a group"
                description="Choose a bundle group on the left, or create one to start mapping components."
              />
            </Card>
          ) : (
            <Card>
              <CardTitle
                title={selected.name}
                subtitle={selected.relationshipSource ?? "MANUAL"}
                action={
                  <Button
                    disabled={busyId === selected.id}
                    onClick={() => void deleteGroup(selected.id)}
                  >
                    Delete group
                  </Button>
                }
              />

              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-name">Name</label>
                  <input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-notes">Notes</label>
                <textarea
                  id="edit-notes"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={savingMeta || !editName.trim()}
                  onClick={() => void saveMeta()}
                >
                  {savingMeta ? "Saving…" : "Save details"}
                </Button>
              </div>

              <div className="ee-sec-title" style={{ marginTop: 8 }}>
                Components
              </div>
              <div className="chip-row pl in bundle-chips">
                {(selected.items ?? []).length ? (
                  (selected.items ?? []).map((it) => {
                    const summary =
                      it.incidentSummary ?? it.inventoryItem?.incidentSummary;
                    return (
                      <div
                        className={`bundle-chip${it.refillAtRisk ? " risk" : ""}`}
                        key={it.id}
                      >
                        <div className="bc-top">
                          <b>{itemLabel(it.inventoryItem)}</b>
                          <button
                            type="button"
                            aria-label="Remove item"
                            disabled={busyId === it.id}
                            onClick={() => void removeItem(selected.id, it.id)}
                          >
                            ×
                          </button>
                        </div>
                        <div className="bc-meta m">
                          {it.role}
                          {it.quantity != null ? ` · qty ${it.quantity}` : ""}
                          {it.refillAtRisk
                            ? ` · refill ≤ ${it.refillThreshold ?? 10}`
                            : ""}
                        </div>
                        <IncidentSummaryBadge
                          summary={summary}
                          productId={it.inventoryItemId}
                        />
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    icon="bu"
                    title="No components yet"
                    description="Search products below and add them to this group."
                  />
                )}
              </div>

              <div className="ee-sec-title" style={{ marginTop: 18 }}>
                Add product
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="bg-role">Role</label>
                  <select
                    id="bg-role"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as (typeof ROLES)[number])
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="filters">
                <input
                  type="search"
                  placeholder="Search products…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchProducts();
                  }}
                  aria-label="Search products to add"
                />
                <Button onClick={() => void searchProducts()}>Search</Button>
              </div>
              {hits.length ? (
                <div className="search-hits">
                  {hits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void addItem(p.id)}
                    >
                      <b>{itemLabel(p)}</b>
                      <div className="m mono">
                        {p.sku ? `SKU ${p.sku}` : p.id}
                      </div>
                      <IncidentSummaryBadge
                        summary={p.incidentSummary}
                        productId={p.id}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="m" style={{ marginTop: 12 }}>
                  Search to find inventory items to attach.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
