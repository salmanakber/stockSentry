"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../lib/api";
import type { AdminPlan, AdminShop } from "../../lib/types";

export default function ShopsPage() {
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [shopRes, planRes] = await Promise.all([
        adminRequest<{ items: AdminShop[] }>("/api/admin/shops"),
        adminRequest<{ items: AdminPlan[] }>("/api/admin/plans"),
      ]);
      setShops(
        (shopRes.items ?? []).map((s) => ({
          ...s,
          complimentary: s.planAssignedByAdmin,
        })),
      );
      setPlans(planRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shops");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignPlan = async (
    shopId: string,
    planSlug: string,
    complimentary = false,
  ) => {
    setBusyId(shopId);
    setMsg(null);
    setError(null);
    try {
      await adminRequest(`/api/admin/shops/${encodeURIComponent(shopId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          planSlug,
          skipShopifyBilling: complimentary || true,
        }),
      });
      setMsg(
        complimentary
          ? `Complimentary ${planSlug} assigned`
          : `Plan set to ${planSlug}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>Shops</h1>
          <div className="sub">Assign plans or complimentary access</div>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Billing</th>
                <th>Assign plan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.shopDomain}</b>
                    {s.complimentary || s.planAssignedByAdmin ? (
                      <>
                        {" "}
                        <span className="chip on">admin / complimentary</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className="chip">{s.installationStatus}</span>
                  </td>
                  <td className="mono">{s.planSlug}</td>
                  <td>{s.billingStatus}</td>
                  <td>
                    <select
                      disabled={busyId === s.id}
                      value={s.planSlug}
                      onChange={(e) =>
                        void assignPlan(s.id, e.target.value, false)
                      }
                    >
                      {(plans.length
                        ? plans.map((p) => p.slug)
                        : ["free", "starter", "pro", "growth"]
                      ).map((slug) => (
                        <option key={slug} value={slug}>
                          {slug}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === s.id}
                      onClick={() => void assignPlan(s.id, "pro", true)}
                    >
                      Complimentary Pro
                    </button>
                  </td>
                </tr>
              ))}
              {!shops.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No shops found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
