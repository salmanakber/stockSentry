"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./Button";
import { apiRequest } from "../lib/api";
import type { BillingStatusResponse, MerchantPlan } from "../lib/types";
import { refreshAppGates } from "../lib/gates";
import { useShop } from "../providers";

function formatPrice(usd: number): string {
  if (usd <= 0) return "$0";
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

function planFeatureBullets(plan: MerchantPlan): string[] {
  const bullets = [
    `${plan.maxMonitoredItems.toLocaleString()} monitored items`,
    `${plan.historyDays}-day history`,
    `${plan.maxOpenIncidents.toLocaleString()} open incidents`,
    `${plan.aiReportsPerMonth} AI reports / mo`,
  ];
  if (plan.exportsEnabled) bullets.push("CSV exports");
  if (plan.advancedRules) bullets.push("Advanced detection rules");
  if (plan.teamWorkflows) bullets.push("Team workflows");
  if ((plan.trialDays ?? 0) > 0) bullets.push(`${plan.trialDays}-day trial`);
  return bullets;
}

interface PlanPickerProps {
  onSelected: () => void;
}

export function PlanPicker({ onSelected }: PlanPickerProps) {
  const { shop } = useShop();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MerchantPlan[]>([]);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bill, planList] = await Promise.all([
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() =>
          apiRequest<BillingStatusResponse>("/api/v1/billing", { shop }),
        ),
        apiRequest<{ items: MerchantPlan[] }>("/api/v1/plans", { shop }).catch(
          () => ({ items: [] as MerchantPlan[] }),
        ),
      ]);
      setBilling(bill);
      setPlans(planList.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectFree = async () => {
    if (busy) return;
    setBusy("free");
    setError(null);
    try {
      await apiRequest("/api/v1/billing/select-free", {
        method: "POST",
        shop,
        body: JSON.stringify({}),
      }).catch(() =>
        apiRequest("/api/v1/billing/subscribe", {
          method: "POST",
          shop,
          body: JSON.stringify({ planSlug: "free" }),
        }),
      );
      refreshAppGates();
      onSelected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not select Free");
    } finally {
      setBusy(null);
    }
  };

  const subscribe = async (planSlug: string) => {
    if (busy) return;
    if (planSlug === "free") {
      await selectFree();
      return;
    }
    setBusy(planSlug);
    setError(null);
    try {
      const res = await apiRequest<{
        confirmationUrl?: string | null;
        message?: string;
      }>("/api/v1/billing/subscribe", {
        method: "POST",
        shop,
        body: JSON.stringify({ planSlug }),
      });
      if (res.confirmationUrl) {
        window.open(res.confirmationUrl, "_top");
        return;
      }
      refreshAppGates();
      onSelected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="plan-gate">
      <div className="plan-gate-inner">
        <div className="plan-gate-brand">
          <div className="mk">
            <svg viewBox="0 0 24 24">
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <b>StockSentry</b>
            <small>Choose a plan to continue</small>
          </div>
        </div>
        <h1>Select your plan</h1>
        <p>
          Before you can use StockSentry, pick Free or a paid plan. You can
          change this later in Billing.
        </p>
        {error ? (
          <div className="banner" role="alert">
            <div>
              <strong>Something went wrong</strong>
              {error}
            </div>
          </div>
        ) : null}
        {loading ? (
          <p className="plan-gate-loading">Loading plans…</p>
        ) : (
          <div className="plan-grid">
            {(plans.length
              ? plans
              : [
                  {
                    slug: "free",
                    displayName: "Free",
                    priceUsdMonthly: 0,
                    maxMonitoredItems: 100,
                    historyDays: 14,
                    maxOpenIncidents: 25,
                    aiReportsPerMonth: 5,
                    exportsEnabled: false,
                    advancedRules: false,
                    teamWorkflows: false,
                  } satisfies MerchantPlan,
                ]
            ).map((plan) => {
              const paid = plan.priceUsdMonthly > 0;
              return (
                <div key={plan.slug} className="plan-card">
                  <div>
                    <b>{plan.displayName}</b>
                  </div>
                  <div className="price">
                    {formatPrice(plan.priceUsdMonthly)}
                    {paid ? <small> / mo</small> : null}
                  </div>
                  {plan.description ? (
                    <p className="desc">{plan.description}</p>
                  ) : null}
                  <ul>
                    {planFeatureBullets(plan).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <div className="form-actions">
                    <Button
                      variant={paid ? "primary" : undefined}
                      disabled={busy !== null}
                      onClick={() => void subscribe(plan.slug)}
                    >
                      {busy === plan.slug
                        ? paid
                          ? "Opening…"
                          : "Selecting…"
                        : paid
                          ? `Subscribe ${plan.displayName}`
                          : "Continue with Free"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {billing?.planSlug ? (
          <p className="plan-gate-note">
            Current local plan before selection: {billing.planSlug}
          </p>
        ) : null}
        <p className="plan-gate-links">
          <Link href="/help">Help</Link>
          {" · "}
          <Link href="/billing">Billing details</Link>
        </p>
      </div>
    </div>
  );
}
