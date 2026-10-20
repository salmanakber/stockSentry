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
  BillingStatusResponse,
  DetectionRuleRow,
  MerchantPlan,
  NotificationPrefRow,
  SettingsResponse,
  SettingsThresholds,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

type PrefChannel = "IN_APP" | "EMAIL";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

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

export default function SettingsPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intervalHours, setIntervalHours] = useState(6);
  const [thresholds, setThresholds] = useState<SettingsThresholds>({
    absoluteChangeThreshold: 30,
    percentageChangeThreshold: 50,
    minBaselineForPercentage: 20,
    repeatedChangeWindowMinutes: 10,
    duplicateSuppressionMinutes: 30,
  });
  const [rules, setRules] = useState<DetectionRuleRow[]>([]);
  const [prefs, setPrefs] = useState<
    Record<PrefChannel, { enabled: boolean; minSeverity: string }>
  >({
    IN_APP: { enabled: true, minSeverity: "MEDIUM" },
    EMAIL: { enabled: false, minSeverity: "HIGH" },
  });
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [plans, setPlans] = useState<MerchantPlan[]>([]);
  const [subscribeBusy, setSubscribeBusy] = useState<string | null>(null);

  const applySettings = (res: SettingsResponse) => {
    setIntervalHours(
      res.shop?.reconciliationIntervalHours ??
        num(res.settings?.thresholds?.reconciliationIntervalHours, 6),
    );
    const t = (res.settings?.thresholds ?? {}) as SettingsThresholds;
    setThresholds({
      absoluteChangeThreshold: num(t.absoluteChangeThreshold, 30),
      percentageChangeThreshold: num(t.percentageChangeThreshold, 50),
      minBaselineForPercentage: num(t.minBaselineForPercentage, 20),
      repeatedChangeWindowMinutes: num(t.repeatedChangeWindowMinutes, 10),
      duplicateSuppressionMinutes: num(t.duplicateSuppressionMinutes, 30),
    });
    setRules(res.detectionRules ?? []);
    const next = {
      IN_APP: { enabled: true, minSeverity: "MEDIUM" },
      EMAIL: { enabled: false, minSeverity: "HIGH" },
    };
    for (const p of res.notificationPreferences ?? []) {
      if (p.channel === "IN_APP" || p.channel === "EMAIL") {
        next[p.channel] = {
          enabled: Boolean(p.enabled),
          minSeverity: p.minSeverity || "MEDIUM",
        };
      }
    }
    setPrefs(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, bill, planList] = await Promise.all([
        apiRequest<SettingsResponse>("/api/v1/settings", { shop }),
        apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
          shop,
        }).catch(() =>
          apiRequest<BillingStatusResponse>("/api/v1/billing", { shop }),
        ),
        apiRequest<{ items: MerchantPlan[] }>("/api/v1/plans", { shop }).catch(
          () => ({ items: [] as MerchantPlan[] }),
        ),
      ]);
      applySettings(settings);
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

  useReveal(ready && !loading, null, [rules, billing, ready, loading]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const notificationPreferences: NotificationPrefRow[] = (
        ["IN_APP", "EMAIL"] as PrefChannel[]
      ).map((channel) => ({
        channel,
        enabled: prefs[channel].enabled,
        minSeverity: prefs[channel].minSeverity,
      }));

      const res = await apiRequest<SettingsResponse>("/api/v1/settings", {
        method: "PATCH",
        shop,
        body: JSON.stringify({
          reconciliationIntervalHours: intervalHours,
          thresholds,
          detectionRules: rules.map((r) => ({
            ruleType: r.ruleType,
            enabled: r.enabled,
          })),
          notificationPreferences,
        }),
      });
      applySettings(res);
      showToast("Settings saved");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
        await load();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setSubscribeBusy(null);
    }
  };

  const setThreshold = (key: keyof SettingsThresholds, value: number) => {
    setThresholds((t) => ({ ...t, [key]: value }));
  };

  return (
    <div className="pg">
      <PageHeader
        title="Settings"
        subtitle="Monitoring interval, rules, and notification preferences."
        actions={
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        }
      />

      {loading ? (
        <Card loading>
          <EmptyState
            icon="se"
            title="Loading settings"
            description="Fetching shop configuration…"
          />
        </Card>
      ) : (
        <div className="col2" style={{ gap: 16, display: "flex" }}>
          <Card>
            <CardTitle
              title="Monitoring"
              subtitle="Reconciliation cadence and detection thresholds"
            />
            <div className="field">
              <label htmlFor="rec-hours">Reconciliation interval (hours)</label>
              <input
                id="rec-hours"
                type="number"
                min={1}
                value={intervalHours}
                onChange={(e) =>
                  setIntervalHours(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="th-abs">Absolute change</label>
                <input
                  id="th-abs"
                  type="number"
                  value={thresholds.absoluteChangeThreshold ?? 30}
                  onChange={(e) =>
                    setThreshold(
                      "absoluteChangeThreshold",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="th-pct">Percent change</label>
                <input
                  id="th-pct"
                  type="number"
                  value={thresholds.percentageChangeThreshold ?? 50}
                  onChange={(e) =>
                    setThreshold(
                      "percentageChangeThreshold",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="th-base">Min baseline</label>
                <input
                  id="th-base"
                  type="number"
                  value={thresholds.minBaselineForPercentage ?? 20}
                  onChange={(e) =>
                    setThreshold(
                      "minBaselineForPercentage",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="th-win">Repeated window (min)</label>
                <input
                  id="th-win"
                  type="number"
                  value={thresholds.repeatedChangeWindowMinutes ?? 10}
                  onChange={(e) =>
                    setThreshold(
                      "repeatedChangeWindowMinutes",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="th-sup">Suppression (min)</label>
                <input
                  id="th-sup"
                  type="number"
                  value={thresholds.duplicateSuppressionMinutes ?? 30}
                  onChange={(e) =>
                    setThreshold(
                      "duplicateSuppressionMinutes",
                      Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle
              title="Detection rules"
              subtitle="Toggle which deterministic rules can open incidents"
            />
            {!rules.length ? (
              <EmptyState
                icon="se"
                title="No rules configured"
                description="Rules are seeded on install. Sync or reinstall if this list stays empty."
              />
            ) : (
              rules.map((r) => (
                <label className="field-check" key={r.ruleType}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((x) =>
                          x.ruleType === r.ruleType
                            ? { ...x, enabled: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <span>{r.ruleType.replace(/_/g, " ")}</span>
                </label>
              ))
            )}
          </Card>

          <Card>
            <CardTitle
              title="Notifications"
              subtitle="In-app and email delivery preferences"
            />
            {(["IN_APP", "EMAIL"] as PrefChannel[]).map((channel) => (
              <div key={channel} style={{ marginBottom: 16 }}>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={prefs[channel].enabled}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        [channel]: {
                          ...p[channel],
                          enabled: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{channel === "IN_APP" ? "In-app" : "Email"} enabled</span>
                </label>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`sev-${channel}`}>Min severity</label>
                  <select
                    id={`sev-${channel}`}
                    value={prefs[channel].minSeverity}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        [channel]: {
                          ...p[channel],
                          minSeverity: e.target.value,
                        },
                      }))
                    }
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <CardTitle
              title="Billing"
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
        </div>
      )}
    </div>
  );
}
