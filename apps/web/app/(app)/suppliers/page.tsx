"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type {
  SupplierListItem,
  SuppliersListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

export default function SuppliersPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<SupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<SuppliersListResponse>(
        "/api/v1/suppliers",
        { shop },
      );
      setItems(res?.items ?? []);
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

  const create = async () => {
    if (!name.trim() || creating) return;
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
      showToast("Supplier created");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Suppliers"
        subtitle="Link suppliers to inventory items for risk context."
      />

      <div className="split">
        <Card>
          <CardTitle title="Add supplier" subtitle="Name and optional contact" />
          <div className="field">
            <label htmlFor="sup-name">Name</label>
            <input
              id="sup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Wholesale"
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
            <Button
              variant="primary"
              disabled={creating || !name.trim()}
              onClick={() => void create()}
            >
              {creating ? "Saving…" : "Create supplier"}
            </Button>
          </div>
        </Card>

        <Card loading={loading}>
          <CardTitle
            title="Suppliers"
            subtitle={
              items.length
                ? `${items.length} listed`
                : "No suppliers yet"
            }
          />
          {!items.length ? (
            <EmptyState
              icon="pr"
              title="No suppliers"
              description="Create a supplier, then attach products on its detail page."
            />
          ) : (
            items.map((s) => (
              <div className="list-row" key={s.id}>
                <div>
                  <b>
                    <Link
                      href={`/suppliers/${encodeURIComponent(s.id)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {s.name}
                    </Link>
                  </b>
                  <div className="m">
                    {s.contactEmail ?? "No email"}
                    {s.active === false ? " · inactive" : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono m">{s.itemCount ?? 0} items</div>
                  {(s.openIncidentCount ?? 0) > 0 ? (
                    <span className="chip hot">
                      {s.openIncidentCount} open
                    </span>
                  ) : (
                    <span className="m">No open risk</span>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
