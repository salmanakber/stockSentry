"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { IncidentSummaryBadge } from "../../../components/IncidentBadge";
import { ProductPickerModal } from "../../../components/ProductPickerModal";
import { ProductThumb } from "../../../components/ProductThumb";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { UpgradeBanner } from "../../../components/UpgradeBanner";
import { apiRequest } from "../../../lib/api";
import { DEMO_BUNDLES } from "../../../lib/demo-data";
import type {
  BillingStatusResponse,
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

function riskChip(g: BundleGroup): { label: string; kind: "hot" | "warn" | "ok" } {
  if (g.hasOpenIncidents) return { label: "Open alerts", kind: "hot" };
  if (g.hasRefillRisk) return { label: "Refill risk", kind: "warn" };
  return { label: "Healthy", kind: "ok" };
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
  const [entitlement, setEntitlement] = useState<{
    code?: string;
    message?: string;
  } | null>(null);
  const [atBundleLimit, setAtBundleLimit] = useState(false);

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
        setAtBundleLimit(false);
        return;
      }
      const [res, bill] = await Promise.all([
        apiRequest<BundlesListResponse>("/api/v1/bundles", { shop }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() => null),
      ]);
      const next = res?.items ?? [];
      setGroups(next);
      setSelectedId((prev) => {
        if (prev && next.some((g) => g.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
      const max = bill?.entitlements?.maxBundleGroups;
      setAtBundleLimit(
        typeof max === "number" && max >= 0 && next.length >= max,
      );
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
    setEntitlement(null);
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
      const err = e as Error & { code?: string };
      const code = err.code;
      const message = e instanceof Error ? e.message : "Create failed";
      if (typeof code === "string" && code.startsWith("ENTITLEMENT_")) {
        setEntitlement({ code, message });
      }
      showToast(message);
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
      setPickerOpen(false);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Add products failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (groupId: string, itemId: string) => {
    if (busyId) return;
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
      <header className="bundle-hero">
        <div>
          <p className="inv-eyebrow">Catalog</p>
          <h1>Bundle Groups</h1>
          <p>
            Map gift sets and kits to components — alerts only, never writes
            Shopify qty.
          </p>
        </div>
      </header>

      <section className="bundle-steps">
        <div className="bundle-step" style={{ ["--k" as string]: 0 }}>
          <span className="bundle-step-n">1</span>
          <div>
            <b>Create a group</b>
            <small>Name the gift set or kit you sell</small>
          </div>
        </div>
        <div className="bundle-step-line" aria-hidden />
        <div className="bundle-step" style={{ ["--k" as string]: 1 }}>
          <span className="bundle-step-n">2</span>
          <div>
            <b>Add components</b>
            <small>Attach the products that make up the bundle</small>
          </div>
        </div>
        <div className="bundle-step-line" aria-hidden />
        <div className="bundle-step" style={{ ["--k" as string]: 2 }}>
          <span className="bundle-step-n">3</span>
          <div>
            <b>Watch risk</b>
            <small>Investigate when components flag or run low</small>
          </div>
        </div>
      </section>

      {entitlement ? (
        <UpgradeBanner
          code={entitlement.code}
          message={entitlement.message}
        />
      ) : null}

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
      ) : !groups.length && !loading ? (
        <Card className="bundle-empty-card">
          <EmptyState
            icon="bu"
            title="No bundle groups yet"
            description="Create a group for a kit or gift set, then add the products that make it up. StockSentry highlights risk — it never changes Shopify quantities."
            action={
              <div className="bundle-empty-form">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Holiday gift set"
                  disabled={demo}
                  aria-label="New group name"
                />
                <Button
                  variant="primary"
                  disabled={!name.trim() || creating || demo}
                  onClick={() => void createGroup()}
                >
                  {creating ? "Creating…" : "Create first group"}
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="bundle-studio-layout">
          <aside className="bundle-studio-list">
            <div className="bundle-gallery">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} loading className="bundle-card">
                      <div className="bundle-card-top">
                        <b>Loading…</b>
                      </div>
                    </Card>
                  ))
                : groups.map((g) => {
                    const count = g.items?.length ?? 0;
                    const risk = riskChip(g);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`bundle-card${selectedId === g.id ? " on" : ""}`}
                        onClick={() => setSelectedId(g.id)}
                      >
                        <div className="bundle-card-top">
                          <b>{g.name}</b>
                          <span className={`chip ${risk.kind === "ok" ? "on" : risk.kind === "hot" ? "hot" : ""}`}>
                            {risk.label}
                          </span>
                        </div>
                        <div className="bundle-card-meta">
                          {count} component{count === 1 ? "" : "s"}
                          {g.openComponentCount
                            ? ` · ${g.openComponentCount} open`
                            : ""}
                        </div>
                      </button>
                    );
                  })}
            </div>

            <Card className="bundle-create-card">
              <CardTitle title="New group" subtitle="Add another kit mapping" />
              <div className="bundle-create">
                <div className="field">
                  <label htmlFor="bg-name">Name</label>
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
                <div
                  className="form-actions"
                  style={{ alignItems: "center", marginTop: 0 }}
                >
                  <Button
                    variant="primary"
                    disabled={
                      !name.trim() || creating || demo || atBundleLimit
                    }
                    onClick={() => void createGroup()}
                    title={
                      atBundleLimit || entitlement
                        ? "Upgrade to Pro"
                        : undefined
                    }
                  >
                    {creating ? "Creating…" : "Create group"}
                  </Button>
                  <PlanLockBadge locked={atBundleLimit} />
                </div>
              </div>
            </Card>
          </aside>

          <div className="bundle-studio-detail">
            {!selected ? (
              <Card>
                <EmptyState
                  icon="bu"
                  title="Select a group"
                  description="Choose a bundle card, or create one to start mapping components."
                />
              </Card>
            ) : (
              <Card className="bundle-detail-card">
                <div className="bundle-detail-sticky">
                  <CardTitle
                    title={selected.name}
                    subtitle={selected.relationshipSource ?? "MANUAL"}
                    action={
                      <div className="bundle-detail-actions">
                        <Button
                          variant="primary"
                          disabled={!selectedId || busyId === "add"}
                          onClick={() => setPickerOpen(true)}
                        >
                          Add products…
                        </Button>
                        <Button
                          disabled={busyId === selected.id || demo}
                          onClick={() => void deleteGroup(selected.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    }
                  />
                </div>

                <div className="bundle-detail-cols">
                  <div>
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
                        rows={3}
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
                    <div className="field" style={{ marginTop: 12 }}>
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

                  <div>
                    <div className="ee-sec-title">Components</div>
                    <div className="bundle-comps">
                      {(selected.items ?? []).length ? (
                        (selected.items ?? []).map((it) => {
                          const summary =
                            it.incidentSummary ??
                            it.inventoryItem?.incidentSummary;
                          const label = itemLabel(it.inventoryItem);
                          return (
                            <div
                              className={`bundle-comp${it.refillAtRisk ? " risk" : ""}`}
                              key={it.id}
                            >
                              <ProductThumb
                                src={it.inventoryItem?.imageUrl}
                                label={label}
                                size="md"
                              />
                              <div className="bundle-comp-body">
                                <b title={label}>{label}</b>
                                <div className="bundle-comp-meta">
                                  <span className="role">{it.role}</span>
                                  {it.quantity != null ? (
                                    <span className="qty">qty {it.quantity}</span>
                                  ) : null}
                                  {it.refillAtRisk ? (
                                    <span className="qty">
                                      refill ≤ {it.refillThreshold ?? 10}
                                    </span>
                                  ) : null}
                                  <IncidentSummaryBadge
                                    summary={summary}
                                    productId={it.inventoryItemId}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="bundle-comp-x"
                                aria-label="Remove item"
                                disabled={busyId === it.id || demo}
                                onClick={() =>
                                  void removeItem(selected.id, it.id)
                                }
                              >
                                ×
                              </button>
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
                  </div>
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
