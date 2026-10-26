"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { IncidentSummaryBadge } from "../../../components/IncidentBadge";
import { ProductPickerModal } from "../../../components/ProductPickerModal";
import { ProductThumb } from "../../../components/ProductThumb";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { UpgradeBanner } from "../../../components/UpgradeBanner";
import { Icon } from "../../../components/IconSprite";
import { apiRequest } from "../../../lib/api";
import { DEMO_BUNDLES } from "../../../lib/demo-data";
import type {
  BillingStatusResponse,
  BundleGroup,
  BundleGroupItem,
  BundlesListResponse,
  ProductItem,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const ROLES = ["COMPONENT", "BUNDLE", "SHARED"] as const;

type StockStatus = "in" | "low" | "out";
type DetailTab = "overview" | "components" | "inventory" | "history";
type StatusFilter = "all" | StockStatus;

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

function primarySku(g: BundleGroup): string {
  const first = g.items?.[0]?.inventoryItem?.sku?.trim();
  return first || "—";
}

function primaryImage(g: BundleGroup): string | null {
  return g.items?.[0]?.inventoryItem?.imageUrl ?? null;
}

function stockStatus(g: BundleGroup): StockStatus {
  const items = g.items ?? [];
  if (!items.length) return "in";
  const qtys = items.map((it) =>
    typeof it.quantity === "number" ? it.quantity : null,
  );
  if (qtys.some((q) => q === 0)) return "out";
  if (g.hasOpenIncidents || g.hasRefillRisk) return "low";
  if (qtys.some((q) => q != null && q > 0 && q <= (items[0]?.refillThreshold ?? 10)))
    return "low";
  return "in";
}

function statusLabel(s: StockStatus): string {
  if (s === "out") return "Out of Stock";
  if (s === "low") return "Low Stock";
  return "In Stock";
}

function bottleneckStock(g: BundleGroup): number | null {
  const qtys = (g.items ?? [])
    .map((it) => (typeof it.quantity === "number" ? it.quantity : null))
    .filter((q): q is number => q != null);
  if (!qtys.length) return null;
  return Math.min(...qtys);
}

function componentStatusLabel(it: BundleGroupItem): {
  kind: StockStatus;
  text: string;
} {
  const q = typeof it.quantity === "number" ? it.quantity : null;
  if (q === 0) return { kind: "out", text: "Out of stock: 0" };
  if (it.refillAtRisk || (q != null && q <= (it.refillThreshold ?? 10))) {
    return { kind: "low", text: `Low stock: ${q ?? "—"}` };
  }
  if (q != null) return { kind: "in", text: `In stock: ${q}` };
  return { kind: "in", text: "In stock" };
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
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  const stats = useMemo(() => {
    const total = groups.length;
    const components = groups.reduce(
      (n, g) => n + (g.items?.length ?? 0),
      0,
    );
    const atRisk = groups.filter((g) => stockStatus(g) !== "in").length;
    const healthy = groups.filter((g) => stockStatus(g) === "in").length;
    return { total, components, atRisk, healthy };
  }, [groups]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      const st = stockStatus(g);
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (!needle) return true;
      const hay = [
        g.name,
        g.description,
        primarySku(g),
        ...(g.items ?? []).flatMap((it) => [
          it.inventoryItem?.productTitle,
          it.inventoryItem?.sku,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [groups, q, statusFilter]);

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

  useReveal(ready && !loading, null, [
    groups,
    ready,
    loading,
    selectedId,
    filtered,
  ]);

  useEffect(() => {
    if (!menuId) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const btn = menuBtnRefs.current.get(menuId);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = 168;
      const left = Math.min(
        Math.max(8, r.right - width),
        window.innerWidth - width - 8,
      );
      setMenuPos({ top: r.bottom + 6, left });
    };
    place();
    const onClose = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuBtnRefs.current.get(menuId)?.contains(t) ||
        (t as HTMLElement).closest?.(".bg-menu")
      ) {
        return;
      }
      setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuId(null);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onClose);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const openRowMenu = (id: string) => {
    setMenuId((prev) => (prev === id ? null : id));
  };

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
      setCreateOpen(false);
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
    setMenuId(null);
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
      setDetailTab("components");
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

  const selectedStatus = selected ? stockStatus(selected) : null;
  const selectedStock = selected ? bottleneckStock(selected) : null;
  const allComponentsHealthy =
    selected &&
    (selected.items ?? []).length > 0 &&
    !(selected.hasOpenIncidents || selected.hasRefillRisk) &&
    stockStatus(selected) === "in";

  return (
    <div className="pg bg-studio">
      <header className="bg-hero">
        <div className="bg-hero-copy">
          <p className="inv-eyebrow">Catalog</p>
          <h1>
            Bundle <span>Groups</span>
          </h1>
          <p>
            Map kits and gift sets to components — monitor risk without writing
            Shopify quantities.
          </p>
        </div>
        <div className="bg-hero-banner" aria-hidden={false}>
          <div className="bg-hero-banner-mark">
            <Icon id="sh" />
          </div>
          <div>
            <b>Why groups matter</b>
            <ul>
              <li>Track all components</li>
              <li>Detect low stock early</li>
              <li>Prevent kit stockouts</li>
            </ul>
          </div>
        </div>
      </header>

      <section className="bg-kpi">
        {[
          {
            label: "Total Bundle Groups",
            value: stats.total,
            tone: "acc" as const,
          },
          {
            label: "Total Components",
            value: stats.components,
            tone: "acc" as const,
          },
          {
            label: "At Risk (Low Stock)",
            value: stats.atRisk,
            tone: "hot" as const,
          },
          {
            label: "Healthy Bundles",
            value: stats.healthy,
            tone: "acc" as const,
          },
        ].map((k, i) => (
          <Card
            key={k.label}
            className="bg-kpi-card hv"
            hover
            loading={loading}
            style={{ ["--d" as string]: `${i * 60}ms` }}
          >
            <div className="l">
              <i style={{ background: k.tone === "hot" ? "var(--hot)" : "var(--acc)" }} />
              {k.label}
            </div>
            <div className="v">{k.value}</div>
          </Card>
        ))}
      </section>

      {entitlement ? (
        <UpgradeBanner code={entitlement.code} message={entitlement.message} />
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
        <Card className="bg-empty">
          <EmptyState
            icon="bu"
            title="No bundle groups yet"
            description="Create a group for a kit or gift set, then add the products that make it up."
            action={
              <div className="bg-empty-form">
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
        <div className={`bg-workspace${selected ? " has-detail" : ""}`}>
          <Card loading={loading} className="bg-table-card">
            <div className="bg-toolbar">
              <div className="inv-pill">
                <Icon id="sc" />
                <input
                  type="search"
                  placeholder="Search bundle groups…"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setQ(qInput.trim());
                  }}
                  aria-label="Search bundle groups"
                />
              </div>
              <select
                className="inv-pill-select"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
                <option value="all">All Statuses</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              <Button onClick={() => setQ(qInput.trim())}>Search</Button>
              <Button
                variant="primary"
                disabled={demo || atBundleLimit}
                onClick={() => setCreateOpen((v) => !v)}
              >
                New group
              </Button>
              <PlanLockBadge locked={atBundleLimit} />
            </div>

            {createOpen ? (
              <div className="bg-create-inline">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Group name"
                  disabled={demo}
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes (optional)"
                  disabled={demo}
                />
                <Button
                  variant="primary"
                  disabled={!name.trim() || creating || demo || atBundleLimit}
                  onClick={() => void createGroup()}
                >
                  {creating ? "Creating…" : "Create"}
                </Button>
                <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
              </div>
            ) : null}

            {!filtered.length ? (
              <EmptyState
                icon="bu"
                title="No matching groups"
                description="Try a different search or clear the status filter."
              />
            ) : (
              <div className="bg-table-wrap">
                <table className="bg-table">
                  <thead>
                    <tr>
                      <th className="bg-check"> </th>
                      <th>Bundle Name</th>
                      <th>Components</th>
                      <th>Stock Status</th>
                      <th>Total Stock</th>
                      <th className="bg-actions-col"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => {
                      const st = stockStatus(g);
                      const items = g.items ?? [];
                      const shown = items.slice(0, 3);
                      const extra = Math.max(0, items.length - shown.length);
                      const stock = bottleneckStock(g);
                      const on = selectedId === g.id;
                      return (
                        <tr
                          key={g.id}
                          className={`bg-row${on ? " on" : ""}`}
                          onClick={() => {
                            setSelectedId(g.id);
                            setDetailTab("overview");
                            setMenuId(null);
                          }}
                        >
                          <td
                            className="bg-check"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setSelectedId(on ? null : g.id)
                              }
                              aria-label={`Select ${g.name}`}
                            />
                          </td>
                          <td>
                            <div className="inv-prod">
                              <ProductThumb
                                src={primaryImage(g)}
                                label={g.name}
                                size="md"
                              />
                              <div className="inv-prod-meta">
                                <b>{g.name}</b>
                                <span className="mono inv-sku">
                                  SKU {primarySku(g)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="bg-stack">
                              {shown.map((it) => (
                                <ProductThumb
                                  key={it.id}
                                  src={it.inventoryItem?.imageUrl}
                                  label={itemLabel(it.inventoryItem)}
                                  size="sm"
                                  className="bg-stack-thumb"
                                />
                              ))}
                              {extra > 0 ? (
                                <span className="bg-stack-more">+{extra}</span>
                              ) : null}
                              {!items.length ? (
                                <span className="m">None</span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <span className={`bg-pill ${st}`}>
                              {statusLabel(st)}
                            </span>
                          </td>
                          <td className="mono bg-stock">
                            {stock != null ? stock.toLocaleString() : "—"}
                          </td>
                          <td
                            className="bg-actions-col"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-menu-wrap">
                              <button
                                type="button"
                                className="bg-menu-btn"
                                aria-label="Actions"
                                aria-expanded={menuId === g.id}
                                ref={(el) => {
                                  if (el) menuBtnRefs.current.set(g.id, el);
                                  else menuBtnRefs.current.delete(g.id);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRowMenu(g.id);
                                }}
                              >
                                ···
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selected ? (
            <aside className="bg-detail">
              <div className="bg-detail-head">
                <ProductThumb
                  src={primaryImage(selected)}
                  label={selected.name}
                  size="md"
                />
                <div className="bg-detail-titles">
                  <b>{selected.name}</b>
                  <span className="mono">SKU {primarySku(selected)}</span>
                </div>
                {selectedStatus ? (
                  <span className={`bg-pill ${selectedStatus}`}>
                    {statusLabel(selectedStatus)}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="bg-detail-close"
                  aria-label="Close detail"
                  onClick={() => setSelectedId(null)}
                >
                  ×
                </button>
              </div>

              <div className="bg-tabs" role="tablist">
                {(
                  [
                    ["overview", "Overview"],
                    ["components", "Components"],
                    ["inventory", "Inventory"],
                    ["history", "History"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === id}
                    className={detailTab === id ? "on" : undefined}
                    onClick={() => setDetailTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-detail-body">
                {detailTab === "overview" ? (
                  <>
                    <div className="bg-detail-hero-img">
                      <ProductThumb
                        src={primaryImage(selected)}
                        label={selected.name}
                        size="lg"
                      />
                    </div>
                    <dl className="bg-detail-dl">
                      <div>
                        <dt>Name</dt>
                        <dd>{selected.name}</dd>
                      </div>
                      <div>
                        <dt>SKU</dt>
                        <dd className="mono">{primarySku(selected)}</dd>
                      </div>
                      <div>
                        <dt>Total Stock</dt>
                        <dd className="mono">
                          {selectedStock != null
                            ? selectedStock.toLocaleString()
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          {selectedStatus
                            ? statusLabel(selectedStatus)
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="field">
                      <label htmlFor="edit-name">Edit name</label>
                      <input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={demo}
                      />
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
                    <div className="bg-comp-preview">
                      <div className="ee-sec-title">Components</div>
                      {(selected.items ?? []).slice(0, 4).map((it) => {
                        const label = itemLabel(it.inventoryItem);
                        const cs = componentStatusLabel(it);
                        return (
                          <div className="bg-comp-row" key={it.id}>
                            <ProductThumb
                              src={it.inventoryItem?.imageUrl}
                              label={label}
                              size="sm"
                            />
                            <div className="bg-comp-copy">
                              <b>{label}</b>
                              <span className="mono">
                                {it.inventoryItem?.sku?.trim() || "No SKU"}
                              </span>
                              <span className={`bg-dot ${cs.kind}`}>
                                {cs.text}
                              </span>
                            </div>
                            <span className="bg-mult mono">1x</span>
                          </div>
                        );
                      })}
                    </div>
                    {allComponentsHealthy ? (
                      <div className="bg-ready">
                        All components are available. This bundle is ready to
                        ship.
                      </div>
                    ) : (selected.items ?? []).length ? (
                      <div className="bg-ready warn">
                        Some components need attention before this kit is fully
                        healthy.
                      </div>
                    ) : null}
                  </>
                ) : null}

                {detailTab === "components" ? (
                  <>
                    <div className="bg-detail-actions">
                      <div className="field" style={{ margin: 0, flex: 1 }}>
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
                      <Button
                        variant="primary"
                        disabled={busyId === "add"}
                        onClick={() => setPickerOpen(true)}
                      >
                        Add products…
                      </Button>
                    </div>
                    <div className="bundle-comps">
                      {(selected.items ?? []).length ? (
                        (selected.items ?? []).map((it) => {
                          const summary =
                            it.incidentSummary ??
                            it.inventoryItem?.incidentSummary;
                          const label = itemLabel(it.inventoryItem);
                          const cs = componentStatusLabel(it);
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
                                  <span className={`bg-dot ${cs.kind}`}>
                                    {cs.text}
                                  </span>
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
                  </>
                ) : null}

                {detailTab === "inventory" ? (
                  <div className="bg-tab-panel">
                    <p className="m">
                      Bottleneck stock across components:{" "}
                      <b className="mono">
                        {selectedStock != null
                          ? selectedStock.toLocaleString()
                          : "—"}
                      </b>
                    </p>
                    <ul className="bg-inv-list">
                      {(selected.items ?? []).map((it) => (
                        <li key={it.id}>
                          <span>{itemLabel(it.inventoryItem)}</span>
                          <b className="mono">
                            {typeof it.quantity === "number"
                              ? it.quantity
                              : "—"}
                          </b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {detailTab === "history" ? (
                  <div className="bg-tab-panel">
                    <EmptyState
                      icon="hi"
                      title="History lives in Inventory History"
                      description="Open Inventory History and filter by a component SKU to review quantity observations for this group."
                    />
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
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

      {menuId && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              className="bg-menu bg-menu-fixed"
              style={
                {
                  top: menuPos.top,
                  left: menuPos.left,
                } as CSSProperties
              }
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSelectedId(menuId);
                  setDetailTab("components");
                  setPickerOpen(true);
                  setMenuId(null);
                }}
              >
                Add products
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={busyId === menuId || demo}
                onClick={() => void deleteGroup(menuId)}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
