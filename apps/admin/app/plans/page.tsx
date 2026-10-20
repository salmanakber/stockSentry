"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../lib/api";
import type { AdminPlan } from "../../lib/types";

export default function PlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminRequest<{ items: AdminPlan[] }>("/api/admin/plans");
      setPlans(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (slug: string, patch: Partial<AdminPlan>) => {
    setPlans((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
    );
  };

  const save = async (plan: AdminPlan) => {
    setSaving(plan.slug);
    setMsg(null);
    setError(null);
    try {
      await adminRequest(`/api/admin/plans/${encodeURIComponent(plan.slug)}`, {
        method: "PATCH",
        body: JSON.stringify(plan),
      });
      setMsg(`Saved ${plan.slug}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>Plans</h1>
          <div className="sub">
            Price, limits, feature flags, and active status
          </div>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      {plans.map((plan) => (
        <div className="card" key={plan.slug}>
          <div className="ct">
            <div>
              <h2>
                {plan.displayName}{" "}
                <span className="mono" style={{ color: "var(--mut)" }}>
                  ({plan.slug})
                </span>
              </h2>
              <p>Entitlements applied after save</p>
            </div>
            <span className={`chip ${plan.active !== false ? "on" : "off"}`}>
              {plan.active !== false ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Display name</label>
              <input
                value={plan.displayName}
                onChange={(e) =>
                  update(plan.slug, { displayName: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Price USD / month</label>
              <input
                type="number"
                min={0}
                step={1}
                value={plan.priceUsdMonthly}
                onChange={(e) =>
                  update(plan.slug, {
                    priceUsdMonthly: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="field">
              <label>Max monitored items</label>
              <input
                type="number"
                min={0}
                value={plan.maxMonitoredItems}
                onChange={(e) =>
                  update(plan.slug, {
                    maxMonitoredItems: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="field">
              <label>History days</label>
              <input
                type="number"
                min={0}
                value={plan.historyDays}
                onChange={(e) =>
                  update(plan.slug, {
                    historyDays: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="field">
              <label>Max open incidents</label>
              <input
                type="number"
                min={0}
                value={plan.maxOpenIncidents}
                onChange={(e) =>
                  update(plan.slug, {
                    maxOpenIncidents: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="field">
              <label>AI reports / month</label>
              <input
                type="number"
                min={0}
                value={plan.aiReportsPerMonth}
                onChange={(e) =>
                  update(plan.slug, {
                    aiReportsPerMonth: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          <label className="field-check">
            <input
              type="checkbox"
              checked={plan.advancedRules}
              onChange={(e) =>
                update(plan.slug, { advancedRules: e.target.checked })
              }
            />
            <span>Advanced rules</span>
          </label>
          <label className="field-check">
            <input
              type="checkbox"
              checked={plan.exportsEnabled}
              onChange={(e) =>
                update(plan.slug, { exportsEnabled: e.target.checked })
              }
            />
            <span>Exports enabled</span>
          </label>
          <label className="field-check">
            <input
              type="checkbox"
              checked={plan.teamWorkflows}
              onChange={(e) =>
                update(plan.slug, { teamWorkflows: e.target.checked })
              }
            />
            <span>Team workflows</span>
          </label>
          <label className="field-check">
            <input
              type="checkbox"
              checked={plan.active !== false}
              onChange={(e) => update(plan.slug, { active: e.target.checked })}
            />
            <span>Plan active (selectable)</span>
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="btn p"
              disabled={saving === plan.slug}
              onClick={() => void save(plan)}
            >
              {saving === plan.slug ? "Saving…" : "Save plan"}
            </button>
          </div>
        </div>
      ))}

      {!plans.length ? <p className="muted">No plans loaded.</p> : null}
    </div>
  );
}
