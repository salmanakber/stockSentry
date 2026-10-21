"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type { BillingStatusResponse, MerchantPlan } from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";
import { refreshAppGates } from "../../../lib/gates";

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

export default function BillingPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [plans, setPlans] = useState<MerchantPlan[]>([]);
  const [subscribeBusy, setSubscribeBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    } catch {
      setBilling(null);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [billing, ready, loading]);

  const subscribe = async (planSlug: string) => {
    if (subscribeBusy) return;
    setSubscribeBusy(planSlug);
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
      } else {
        showToast(res.message ?? "Plan updated");
        refreshAppGates();
        await load();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setSubscribeBusy(null);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Billing"
        subtitle="Choose a plan and manage your StockSentry subscription."
      />

      {loading ? (
        <Card loading>
          <EmptyState
            icon="db"
            title="Loading billing"
            description="Fetching plan and subscription status…"
          />
        </Card>
      ) : (
        <Card>
          <CardTitle
            title="Plans"
            subtitle="Current plan and subscription upgrades"
          />
          {billing?.requiresPlanSelection ? (
            <div className="banner" role="status">
              <div>
                <strong>Choose a plan to continue</strong>
                Your previous Shopify subscription was cancelled when the app
                was uninstalled. After reinstalling, Shopify requires you to
                select a plan again before paid features are available.
              </div>
            </div>
          ) : null}
          <div className="facts" style={{ marginBottom: 16 }}>
            <div>
              <small>Plan</small>
              <b>
                {billing?.entitlements?.displayName ??
                  billing?.planSlug ??
                  "—"}
              </b>
            </div>
            <div>
              <small>Status</small>
              <b>{billing?.billingStatus ?? "—"}</b>
            </div>
            <div>
              <small>AI reports</small>
              <b>
                {billing?.usage?.aiReportsUsed != null &&
                billing?.usage?.aiReportsLimit != null
                  ? `${billing.usage.aiReportsUsed} / ${billing.usage.aiReportsLimit}`
                  : "—"}
              </b>
            </div>
          </div>
          {billing?.usage ? (
            <div className="rw">
              <span>Monitored items</span>
              <b>
                {billing.usage.monitoredItems ?? 0} /{" "}
                {billing.usage.maxMonitoredItems ?? "—"}
              </b>
            </div>
          ) : null}
          {plans.length > 0 ? (
            <div className="plan-grid">
              {plans.map((plan) => {
                const current = billing?.planSlug === plan.slug;
                const paid = plan.priceUsdMonthly > 0;
                return (
                  <div
                    key={plan.slug}
                    className={`plan-card${current ? " current" : ""}`}
                  >
                    <div>
                      <b>{plan.displayName}</b>
                      {current ? (
                        <span className="chip on" style={{ marginLeft: 8 }}>
                          Current
                        </span>
                      ) : null}
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
                      {paid ? (
                        <Button
                          variant={current ? undefined : "primary"}
                          disabled={subscribeBusy !== null || current}
                          onClick={() => void subscribe(plan.slug)}
                        >
                          {subscribeBusy === plan.slug
                            ? "Opening…"
                            : current
                              ? "Active"
                              : `Subscribe ${plan.displayName}`}
                        </Button>
                      ) : (
                        <Button
                          disabled={subscribeBusy !== null || current}
                          onClick={() => void subscribe(plan.slug)}
                        >
                          {current ? "On Free" : "Switch to Free"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="form-actions">
              <Button
                variant="primary"
                disabled={subscribeBusy !== null}
                onClick={() => void subscribe("starter")}
              >
                {subscribeBusy === "starter"
                  ? "Opening…"
                  : "Subscribe Starter"}
              </Button>
              <Button
                disabled={subscribeBusy !== null}
                onClick={() => void subscribe("pro")}
              >
                {subscribeBusy === "pro" ? "Opening…" : "Subscribe Pro"}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
