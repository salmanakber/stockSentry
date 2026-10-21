"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "../../../../components/Button";
import { Card, CardTitle } from "../../../../components/Card";
import { useShell } from "../../../../components/AppShell";
import { useToast } from "../../../../components/Toast";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { PageHeader } from "../../../../components/shared/PageHeader";
import { apiRequest } from "../../../../lib/api";
import type {
  ProductItem,
  ProductsListResponse,
  SupplierDetail,
} from "../../../../lib/types";
import { useShop } from "../../../../providers";
import { useReveal } from "../../../../hooks/useReveal";

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

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const router = useRouter();
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [data, setData] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<ProductItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<SupplierDetail>(
        `/api/v1/suppliers/${encodeURIComponent(id)}`,
        { shop },
      );
      setData(res);
      setName(res.name ?? "");
      setContactEmail(res.contactEmail ?? "");
      setContactName(res.contactName ?? "");
      setNotes(res.notes ?? "");
      setLeadTimeDays(
        res.leadTimeDays != null ? String(res.leadTimeDays) : "",
      );
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [data, ready, loading]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await apiRequest(`/api/v1/suppliers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        shop,
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          contactName: contactName.trim() || null,
          notes: notes.trim() || null,
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
        }),
      });
      showToast("Supplier saved");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/suppliers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        shop,
      });
      showToast("Supplier deleted");
      router.push("/suppliers");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
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

  const attach = async (inventoryItemId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/api/v1/suppliers/${encodeURIComponent(id)}/items`, {
        method: "POST",
        shop,
        body: JSON.stringify({ inventoryItemId }),
      });
      showToast("Product attached");
      setSearchQ("");
      setHits([]);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Attach failed");
    } finally {
      setBusy(false);
    }
  };

  const detach = async (inventoryItemId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/suppliers/${encodeURIComponent(id)}/items/${encodeURIComponent(inventoryItemId)}`,
        { method: "DELETE", shop },
      );
      showToast("Product detached");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Detach failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title={data?.name ?? "Supplier"}
        subtitle="Edit details and attach products"
        actions={
          <Link href="/suppliers" className="btn">
            All suppliers
          </Link>
        }
      />

      {loading && !data ? (
        <Card loading>
          <EmptyState
            icon="pr"
            title="Loading…"
            description="Fetching supplier details…"
          />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon="pr"
            title="Supplier not found"
            description="This supplier may have been deleted."
            action={
              <Link href="/suppliers" className="btn p">
                Back
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="detail-grid">
          <div className="col2">
            <Card>
              <CardTitle title="Details" subtitle="Contact and lead time" />
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cname">Contact name</label>
                <input
                  id="cname"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cemail">Contact email</label>
                <input
                  id="cemail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lead">Lead time (days)</label>
                <input
                  id="lead"
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="primary"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button disabled={busy} onClick={() => void remove()}>
                  Delete
                </Button>
              </div>
            </Card>

            <Card>
              <CardTitle
                title="Attach products"
                subtitle="Search catalog and link SKUs"
              />
              <div className="filters">
                <input
                  type="search"
                  placeholder="Search title or SKU…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchProducts();
                  }}
                />
                <Button onClick={() => void searchProducts()}>Search</Button>
              </div>
              {hits.map((h) => (
                <div className="list-row" key={h.id}>
                  <div>
                    <b>{itemLabel(h)}</b>
                    <div className="m mono">{h.sku ?? "No SKU"}</div>
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() => void attach(h.id)}
                  >
                    Attach
                  </Button>
                </div>
              ))}
            </Card>
          </div>

          <div className="col2">
            <Card>
              <CardTitle
                title="Linked products"
                subtitle={`${data.items?.length ?? 0} attached`}
              />
              {!data.items?.length ? (
                <EmptyState
                  icon="pr"
                  title="No products linked"
                  description="Search and attach inventory items."
                />
              ) : (
                data.items.map((link) => (
                  <div className="list-row" key={link.id}>
                    <div>
                      <b>
                        <Link
                          href={`/products/${encodeURIComponent(link.inventoryItemId)}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {itemLabel(link.inventoryItem)}
                        </Link>
                      </b>
                      <div className="m mono">
                        {link.inventoryItem?.sku ?? "No SKU"}
                      </div>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => void detach(link.inventoryItemId)}
                    >
                      Detach
                    </Button>
                  </div>
                ))
              )}
            </Card>

            <Card>
              <CardTitle
                title="Open incidents on SKUs"
                subtitle={
                  data.openIncidentCount
                    ? `${data.openIncidentCount} open`
                    : "None open"
                }
              />
              {!data.openIncidents?.length ? (
                <EmptyState
                  icon="in"
                  title="No open incidents"
                  description="Open risk on attached products will list here."
                />
              ) : (
                data.openIncidents.map((inc) => (
                  <div className="list-row" key={inc.id}>
                    <div>
                      <b>
                        <Link
                          href={`/incidents/${encodeURIComponent(inc.id)}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {itemLabel(inc.inventoryItem ?? undefined)}
                        </Link>
                      </b>
                      <div className="m">
                        {inc.severity} · {inc.status} ·{" "}
                        {inc.location?.name ?? "—"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
