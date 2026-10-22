"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { PlanLockBadge } from "../../../components/PlanLockBadge";
import { ProductPickerModal } from "../../../components/ProductPickerModal";
import { apiRequest } from "../../../lib/api";
import type {
  BillingStatusResponse,
  BundleGroup,
  BundlesListResponse,
  ProductItem,
  ReplenishmentRequest,
  ReplenishmentRule,
  SupplierListItem,
  SuppliersListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

function itemLabel(item?: {
  productTitle?: string | null;
  variantTitle?: string | null;
  sku?: string | null;
} | null): string {
  if (!item) return "Item";
  const base = item.productTitle?.trim() || "Untitled";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return item.sku ? `${base} (${item.sku})` : base;
}

function ruleTargetLabel(rule: ReplenishmentRule): string {
  if (rule.bundleGroup?.name) return `Group · ${rule.bundleGroup.name}`;
  return itemLabel(rule.inventoryItem);
}

function requestTargetLabel(req: ReplenishmentRequest): string {
  if (req.bundleGroup?.name) return `Group · ${req.bundleGroup.name}`;
  return itemLabel(req.inventoryItem);
}

function statusChip(status: string): string {
  const s = status.toUpperCase();
  if (s === "SENT") return "chip on";
  if (s === "FAILED" || s === "CANCELLED") return "chip hot";
  if (s === "PENDING_APPROVAL" || s === "DRAFT" || s === "QUEUED") return "chip";
  return "chip";
}

export default function ReplenishmentPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";

  const [rules, setRules] = useState<ReplenishmentRule[]>([]);
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [bundles, setBundles] = useState<BundleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [targetKind, setTargetKind] = useState<"item" | "group">("item");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null,
  );
  const [bundleGroupId, setBundleGroupId] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [restockQty, setRestockQty] = useState("50");
  const [autoEmail, setAutoEmail] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (demo) {
        setRules([]);
        setRequests([]);
        setSuppliers([]);
        setBundles([]);
        setAutomationEnabled(true);
        return;
      }
      const [rulesRes, reqRes, supRes, bunRes, bill] = await Promise.all([
        apiRequest<{ items?: ReplenishmentRule[] }>(
          "/api/v1/replenishment/rules",
          { shop },
        ),
        apiRequest<{ items?: ReplenishmentRequest[] }>(
          "/api/v1/replenishment/requests",
          { shop },
        ),
        apiRequest<SuppliersListResponse>("/api/v1/suppliers", { shop }),
        apiRequest<BundlesListResponse>("/api/v1/bundles", { shop }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() => null),
      ]);
      setRules(rulesRes?.items ?? []);
      setRequests(reqRes?.items ?? []);
      setSuppliers(supRes?.items ?? []);
      setBundles(bunRes?.items ?? []);
      setAutomationEnabled(
        bill?.entitlements?.supplierAutomation !== false,
      );
      setSupplierId((prev) => {
        if (prev) return prev;
        return supRes?.items?.[0]?.id ?? "";
      });
    } catch {
      setRules([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [shop, demo]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [rules, requests, ready, loading]);

  const verifiedSuppliers = useMemo(
    () => suppliers.filter((s) => s.verified),
    [suppliers],
  );

  const createRule = async () => {
    if (demo) {
      showToast("Replenishment rules are disabled in demo mode");
      return;
    }
    if (busy) return;
    if (!supplierId) {
      showToast("Select a supplier");
      return;
    }
    if (targetKind === "item" && !selectedProduct) {
      showToast("Pick a product");
      return;
    }
    if (targetKind === "group" && !bundleGroupId) {
      showToast("Select a bundle group");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/api/v1/replenishment/rules", {
        method: "POST",
        shop,
        body: JSON.stringify({
          supplierId,
          inventoryItemId:
            targetKind === "item" ? selectedProduct!.id : null,
          bundleGroupId: targetKind === "group" ? bundleGroupId : null,
          lowStockThreshold: Number(threshold) || 0,
          restockQuantity: Number(restockQty) || 1,
          autoEmailEnabled: autoEmail,
          requireApproval,
          active: true,
        }),
      });
      showToast("Replenishment rule created");
      setSelectedProduct(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (demo) {
      showToast("Disabled in demo mode");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/replenishment/rules/${encodeURIComponent(id)}`, {
        method: "DELETE",
        shop,
      });
      showToast("Rule deleted");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    if (demo) {
      showToast("Emails are disabled in demo mode");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/replenishment/requests/${encodeURIComponent(id)}/approve`,
        { method: "POST", shop },
      );
      showToast("Replenishment email sent");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (demo) {
      showToast("Disabled in demo mode");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/replenishment/requests/${encodeURIComponent(id)}/cancel`,
        { method: "POST", shop },
      );
      showToast("Request cancelled");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const openStatuses = new Set([
    "DRAFT",
    "PENDING_APPROVAL",
    "QUEUED",
    "FAILED",
  ]);

  return (
    <div className="pg">
      <PageHeader
        title="Replenishment"
        subtitle="Optional supplier restock emails when stock hits your threshold. Read-only — never writes Shopify quantities."
        actions={
          <Link href="/suppliers" className="btn">
            Suppliers
          </Link>
        }
      />

      {demo ? (
        <Card>
          <EmptyState
            icon="db"
            title="Demo mode"
            description="Replenishment rules and supplier emails are not available in sample data. Connect a shop to configure optional automation."
          />
        </Card>
      ) : (
        <div className="detail-grid">
          <div className="col2">
            <Card loading={loading}>
              <CardTitle
                title="Create rule"
                subtitle="Product or bundle group + supplier"
              />
              <div className="field">
                <label htmlFor="rep-sup">Supplier</label>
                <select
                  id="rep-sup"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.verified ? " (verified)" : " (unverified)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="rep-kind">Target</label>
                <select
                  id="rep-kind"
                  value={targetKind}
                  onChange={(e) =>
                    setTargetKind(e.target.value as "item" | "group")
                  }
                >
                  <option value="item">Product</option>
                  <option value="group">Bundle group</option>
                </select>
              </div>
              {targetKind === "item" ? (
                <div className="field">
                  <label>Product</label>
                  <div className="form-actions" style={{ marginTop: 0 }}>
                    <Button onClick={() => setPickerOpen(true)}>
                      {selectedProduct
                        ? itemLabel(selectedProduct)
                        : "Pick product…"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="rep-grp">Bundle group</label>
                  <select
                    id="rep-grp"
                    value={bundleGroupId}
                    onChange={(e) => setBundleGroupId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {bundles.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field-row">
                <div className="field">
                  <label htmlFor="rep-th">Low-stock threshold</label>
                  <input
                    id="rep-th"
                    type="number"
                    min={0}
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rep-qty">Restock quantity</label>
                  <input
                    id="rep-qty"
                    type="number"
                    min={1}
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>
                    <input
                      type="checkbox"
                      checked={autoEmail && automationEnabled}
                      disabled={!automationEnabled}
                      onChange={(e) => setAutoEmail(e.target.checked)}
                    />{" "}
                    Auto-email when threshold hit
                  </span>
                  <PlanLockBadge
                    locked={!automationEnabled}
                    label="Not on your plan"
                  />
                </label>
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={requireApproval}
                    onChange={(e) => setRequireApproval(e.target.checked)}
                  />{" "}
                  Require merchant approval before send
                </label>
              </div>
              <p className="m">
                Auto-send only runs when the supplier is verified, approval is
                off, and a valid contact email is set. Otherwise you approve from
                request history.
              </p>
              {autoEmail && !requireApproval && verifiedSuppliers.length === 0 ? (
                <p className="m" style={{ color: "var(--warn)" }}>
                  No verified suppliers yet — verify a supplier first for
                  auto-send.
                </p>
              ) : null}
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => void createRule()}
                >
                  {busy ? "Saving…" : "Create rule"}
                </Button>
              </div>
            </Card>

            <Card loading={loading}>
              <CardTitle
                title="Active rules"
                subtitle={
                  rules.length ? `${rules.length} configured` : "None yet"
                }
              />
              {!rules.length ? (
                <EmptyState
                  icon="db"
                  title="No rules"
                  description="Create a rule to watch a product or group for low stock."
                />
              ) : (
                rules.map((rule) => (
                  <div className="list-row" key={rule.id}>
                    <div>
                      <b>{ruleTargetLabel(rule)}</b>
                      <div className="m">
                        {rule.supplier?.name ?? "Supplier"} · threshold{" "}
                        {rule.lowStockThreshold} · restock {rule.restockQuantity}
                      </div>
                      <div className="chip-row">
                        {rule.active === false ? (
                          <span className="chip">Inactive</span>
                        ) : (
                          <span className="chip on">Active</span>
                        )}
                        {rule.autoEmailEnabled ? (
                          <span className="chip">Auto email</span>
                        ) : null}
                        {rule.requireApproval !== false ? (
                          <span className="chip">Needs approval</span>
                        ) : null}
                        {rule.supplier?.verified ? (
                          <span className="chip on">Verified supplier</span>
                        ) : (
                          <span className="chip hot">Unverified</span>
                        )}
                      </div>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => void deleteRule(rule.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div className="col2">
            <Card loading={loading}>
              <CardTitle
                title="Request history"
                subtitle="Approve or cancel pending supplier emails"
              />
              {!requests.length ? (
                <EmptyState
                  icon="no"
                  title="No requests yet"
                  description="When stock hits a rule threshold, requests appear here."
                />
              ) : (
                requests.map((req) => (
                  <div className="list-row" key={req.id}>
                    <div>
                      <b>{requestTargetLabel(req)}</b>
                      <div className="m">
                        {req.supplier?.name ?? "Supplier"} · qty {req.quantity}{" "}
                        (threshold {req.threshold})
                      </div>
                      <div className="chip-row">
                        <span className={statusChip(req.status)}>
                          {req.status}
                        </span>
                        {req.errorCode ? (
                          <span className="chip hot">{req.errorCode}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="form-actions" style={{ margin: 0 }}>
                      {openStatuses.has(req.status) ? (
                        <>
                          <Button
                            variant="primary"
                            disabled={busy}
                            onClick={() => void approve(req.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => void cancel(req.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(products) => {
          setSelectedProduct(products[0] ?? null);
          setPickerOpen(false);
        }}
        title="Select product for replenishment rule"
        confirmLabel="Select"
      />
    </div>
  );
}
