"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { IncidentSummaryBadge } from "../../../components/IncidentBadge";
import { ProductPickerModal } from "../../../components/ProductPickerModal";
import { apiRequest } from "../../../lib/api";
import { DEMO_BUNDLES } from "../../../lib/demo-data";
import type {
  BundleGroup,
  BundlesListResponse,
  ProductItem,
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
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";

  const [groups, setGroups] = useState<BundleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("COMPONENT");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (demo) {
        setGroups(DEMO_BUNDLES);
        setSelectedId((prev) => {
          if (prev && DEMO_BUNDLES.some((g) => g.id === prev)) return prev;
          return DEMO_BUNDLES[0]?.id ?? null;
        });
        return;
      }
      const res = await apiRequest<BundlesListResponse>("/api/v1/bundles", {
        shop,
      });
      const next = res?.items ?? [];
      setGroups(next);
      setSelectedId((prev) => {
        if (prev && next.some((g) => g.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    } catch (e) {
      setGroups([]);
      setError(e instanceof Error ? e.message : "Failed to load bundle groups");
    } finally {
      setLoading(false);
    }
  }, [demo, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  );

  const attachedIds = useMemo(
    () => new Set((selected?.items ?? []).map((i) => i.inventoryItemId)),
    [selected],
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
    if (demo) {
      showToast("Creating groups is disabled in demo mode");
      return;
    }
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
    if (demo) {
      showToast("Editing is disabled in demo mode");
      return;
    }
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
    if (demo) {
      showToast("Deleting is disabled in demo mode");
      return;
    }
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

  const addProducts = async (products: ProductItem[]) => {
    if (!selectedId) {
      showToast("Select a bundle group first");
      return;
    }
    if (demo) {
      showToast("Adding products is disabled in demo mode");
      return;
    }
    setBusyId("add");
    try {
      let added = 0;
      for (const p of products) {
        if (attachedIds.has(p.id)) continue;
        await apiRequest(
          `/api/v1/bundles/${encodeURIComponent(selectedId)}/items`,
          {
            method: "POST",
            shop,
            body: JSON.stringify({ inventoryItemId: p.id, role }),
          },
        );
        added += 1;
      }
      showToast(
        added
          ? `Added ${added} product${added === 1 ? "" : "s"}`
          : "No new products to add",
      );
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Add products failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (groupId: string, itemId: string) => {
    if (demo) {
      showToast("Removing is disabled in demo mode");
      return;
    }
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

      {error ? (
        <Card>
          <EmptyState
            icon="bu"
            title="Couldn’t load groups"
            description={error}
            action={
              <Button variant="primary" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : (
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
                    disabled={demo}
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
                    disabled={demo}
                  />
                </div>
                <Button
                  variant="primary"
                  disabled={!name.trim() || creating || demo}
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
                      disabled={busyId === selected.id || demo}
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
                      disabled={demo}
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
                    disabled={demo}
                  />
                </div>
                <div className="form-actions">
                  <Button
                    variant="primary"
                    disabled={savingMeta || !editName.trim() || demo}
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
                              disabled={busyId === it.id || demo}
                              onClick={() =>
                                void removeItem(selected.id, it.id)
                              }
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
                      description="Use Add products to attach inventory items to this group."
                    />
                  )}
                </div>

                <div className="ee-sec-title" style={{ marginTop: 18 }}>
                  Add products
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="bg-role">Role for new items</label>
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
                <div className="form-actions">
                  <Button
                    variant="primary"
                    disabled={!selectedId || busyId === "add"}
                    onClick={() => setPickerOpen(true)}
                  >
                    Add products…
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={addProducts}
        title="Add products to bundle"
        confirmLabel="Add to group"
        excludeIds={attachedIds}
      />
    </div>
  );
}
