"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<ProductItem[]>([]);
  const [role, setRole] = useState<(typeof ROLES)[number]>("COMPONENT");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<BundlesListResponse>("/api/v1/bundles", {
        shop,
      });
      setGroups(res?.items ?? []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [groups, ready, loading]);

  const createGroup = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await apiRequest("/api/v1/bundles", {
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
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
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
      if (activeGroupId === id) setActiveGroupId(null);
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
    if (!activeGroupId) {
      showToast("Select a bundle group first");
      return;
    }
    setBusyId(inventoryItemId);
    try {
      await apiRequest(
        `/api/v1/bundles/${encodeURIComponent(activeGroupId)}/items`,
        {
          method: "POST",
          shop,
          body: JSON.stringify({ inventoryItemId, role }),
        },
      );
      showToast("Item added to group");
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
    <div className="pg">
      <PageHeader
        title="Bundle Groups"
        subtitle="Manual and integration-derived component mappings."
      />

      <div className="split">
        <div className="col2">
          <Card>
            <CardTitle
              title="Create group"
              subtitle="Name a bundle and map components"
            />
            <div className="field">
              <label htmlFor="bg-name">Name</label>
              <input
                id="bg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gift set"
              />
            </div>
            <div className="field">
              <label htmlFor="bg-desc">Description</label>
              <textarea
                id="bg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <div className="form-actions">
              <Button
                variant="primary"
                disabled={!name.trim() || creating}
                onClick={() => void createGroup()}
              >
                {creating ? "Creating…" : "Create group"}
              </Button>
            </div>
          </Card>

          <Card loading={loading}>
            <CardTitle
              title="Groups"
              subtitle={
                groups.length
                  ? `${groups.length} group${groups.length === 1 ? "" : "s"}`
                  : "No groups yet"
              }
            />
            {!groups.length ? (
              <EmptyState
                icon="bu"
                title="No bundle groups"
                description="Create or import bundle groups to see which components are at risk when incidents open."
              />
            ) : (
              groups.map((g) => (
                <div
                  className="bgp"
                  key={g.id}
                  style={{
                    outline:
                      activeGroupId === g.id
                        ? "2px solid var(--accs)"
                        : undefined,
                    borderRadius: 12,
                    padding: "12px 10px",
                    marginLeft: -10,
                    marginRight: -10,
                  }}
                >
                  <div className="t">
                    <span>
                      {g.name}
                      <span className="chip" style={{ marginLeft: 8 }}>
                        {g.relationshipSource ?? "MANUAL"}
                      </span>
                    </span>
                    <div className="btns">
                      <Button
                        onClick={() =>
                          setActiveGroupId((id) =>
                            id === g.id ? null : g.id,
                          )
                        }
                      >
                        {activeGroupId === g.id ? "Selected" : "Add items"}
                      </Button>
                      <Button
                        disabled={busyId === g.id}
                        onClick={() => void deleteGroup(g.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {g.description ? (
                    <p className="m" style={{ margin: "0 0 8px" }}>
                      {g.description}
                    </p>
                  ) : null}
                  <div className="chip-row pl in">
                    {(g.items ?? []).length ? (
                      (g.items ?? []).map((it) => (
                        <i
                          className={`chip${it.refillAtRisk ? " hot" : ""}`}
                          key={it.id}
                          title={
                            it.refillAtRisk
                              ? `Refill risk · qty ${it.quantity ?? "—"} ≤ ${it.refillThreshold ?? 10}`
                              : undefined
                          }
                        >
                          {itemLabel(it.inventoryItem)} · {it.role}
                          {it.refillAtRisk
                            ? ` · refill (qty ${it.quantity ?? "—"})`
                            : ""}
                          <button
                            type="button"
                            aria-label="Remove item"
                            disabled={busyId === it.id}
                            onClick={() => void removeItem(g.id, it.id)}
                          >
                            ×
                          </button>
                        </i>
                      ))
                    ) : (
                      <span className="m">No items yet</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <Card>
          <CardTitle
            title="Add product"
            subtitle={
              activeGroupId
                ? "Search catalog and attach with a role"
                : "Select a group, then search"
            }
          />
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
          <div className="filters">
            <input
              type="search"
              placeholder="Search products…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchProducts();
              }}
              disabled={!activeGroupId}
              aria-label="Search products to add"
            />
            <Button
              disabled={!activeGroupId}
              onClick={() => void searchProducts()}
            >
              Search
            </Button>
          </div>
          {hits.length ? (
            <div className="search-hits">
              {hits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busyId === p.id || !activeGroupId}
                  onClick={() => void addItem(p.id)}
                >
                  <b>{itemLabel(p)}</b>
                  <div className="m mono">
                    {p.sku ? `SKU ${p.sku}` : p.id}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="m" style={{ marginTop: 12 }}>
              {activeGroupId
                ? "Search to find inventory items to attach."
                : "Choose Add items on a group to enable search."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
