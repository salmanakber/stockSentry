"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { EmailTemplateEditor } from "../../../components/email/EmailTemplateEditor";
import { apiRequest } from "../../../lib/api";
import type {
  BillingStatusResponse,
  DetectionRuleRow,
  EmailTemplateRow,
  MerchantPlan,
  NotificationPrefRow,
  SettingsResponse,
  SettingsThresholds,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";
import { ruleTypeLabel } from "@stocksentry/shared";
import { refreshAppGates } from "../../../lib/gates";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const TABS = [
  { id: "monitoring", label: "Monitoring" },
  { id: "detection", label: "Detection" },
  { id: "notifications", label: "Notifications" },
  { id: "email", label: "Email" },
  { id: "ai", label: "AI" },
  { id: "billing", label: "Billing" },
  { id: "general", label: "General" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type PrefChannel = "IN_APP" | "EMAIL";

type PrefState = Record<
  PrefChannel,
  { enabled: boolean; minSeverity: string; destinationRef: string }
>;

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

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

export default function SettingsPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = isTabId(tabParam) ? tabParam : "monitoring";

  const setTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intervalHours, setIntervalHours] = useState(6);
  const [refillThreshold, setRefillThreshold] = useState(10);
  const [thresholds, setThresholds] = useState<SettingsThresholds>({
    absoluteChangeThreshold: 30,
    percentageChangeThreshold: 50,
    minBaselineForPercentage: 20,
    repeatedChangeWindowMinutes: 10,
    duplicateSuppressionMinutes: 30,
  });
  const [rules, setRules] = useState<DetectionRuleRow[]>([]);
  const [prefs, setPrefs] = useState<PrefState>({
    IN_APP: { enabled: true, minSeverity: "MEDIUM", destinationRef: "" },
    EMAIL: { enabled: false, minSeverity: "HIGH", destinationRef: "" },
  });
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [activeTplKey, setActiveTplKey] = useState("INCIDENT_ALERT");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplText, setTplText] = useState("");
  const [tplRevision, setTplRevision] = useState(0);
  const [aiSettings, setAiSettings] = useState<Record<string, unknown>>({});
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [plans, setPlans] = useState<MerchantPlan[]>([]);
  const [subscribeBusy, setSubscribeBusy] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

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
    const monitoring = (res.settings?.monitoring ?? {}) as {
      refillThreshold?: unknown;
      reconciliationIntervalHours?: unknown;
    };
    setRefillThreshold(num(monitoring.refillThreshold, 10));
    setRules(res.detectionRules ?? []);
    setAiSettings(
      (res.settings?.ai && typeof res.settings.ai === "object"
        ? (res.settings.ai as Record<string, unknown>)
        : {}) ?? {},
    );
    setOnboardingCompleted(Boolean(res.shop?.onboardingCompleted));
    const next: PrefState = {
      IN_APP: { enabled: true, minSeverity: "MEDIUM", destinationRef: "" },
      EMAIL: { enabled: false, minSeverity: "HIGH", destinationRef: "" },
    };
    for (const p of res.notificationPreferences ?? []) {
      if (p.channel === "IN_APP" || p.channel === "EMAIL") {
        next[p.channel] = {
          enabled: Boolean(p.enabled),
          minSeverity: p.minSeverity || "MEDIUM",
          destinationRef: p.destinationRef ?? "",
        };
      }
    }
    setPrefs(next);
    const tpls = res.emailTemplates ?? [];
    setEmailTemplates(tpls);
    const active =
      tpls.find((x) => x.key === activeTplKey) ?? tpls[0] ?? null;
    if (active) {
      setActiveTplKey(active.key);
      setTplSubject(active.subject);
      setTplHtml(active.htmlBody);
      setTplText(active.textBody);
      setTplRevision((n) => n + 1);
    }
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

  useReveal(ready && !loading, null, [rules, billing, ready, loading, activeTab]);

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
        destinationRef:
          channel === "EMAIL"
            ? prefs.EMAIL.destinationRef.trim() || null
            : null,
      }));

      const res = await apiRequest<SettingsResponse>("/api/v1/settings", {
        method: "PATCH",
        shop,
        body: JSON.stringify({
          reconciliationIntervalHours: intervalHours,
          thresholds,
          monitoring: {
            reconciliationIntervalHours: intervalHours,
            refillThreshold: Math.max(0, refillThreshold),
          },
          detectionRules: rules.map((r) => ({
            ruleType: r.ruleType,
            enabled: r.enabled,
          })),
          notificationPreferences,
          ai: aiSettings,
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

  const saveTemplate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await apiRequest(
        `/api/v1/settings/email-templates/${encodeURIComponent(activeTplKey)}`,
        {
          method: "PUT",
          shop,
          body: JSON.stringify({
            subject: tplSubject,
            htmlBody: tplHtml,
            textBody: tplText,
          }),
        },
      );
      showToast("Email template saved");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Template save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (testBusy) return;
    setTestBusy(true);
    try {
      await apiRequest("/api/v1/notifications/test-email", {
        method: "POST",
        shop,
        body: JSON.stringify({
          to: prefs.EMAIL.destinationRef.trim() || undefined,
        }),
      });
      showToast("Test email sent (or queued)");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Test email failed");
    } finally {
      setTestBusy(false);
    }
  };

  const selectTemplate = (key: string) => {
    setActiveTplKey(key);
    const t = emailTemplates.find((x) => x.key === key);
    if (t) {
      setTplSubject(t.subject);
      setTplHtml(t.htmlBody);
      setTplText(t.textBody);
      setTplRevision((n) => n + 1);
    }
  };

  const onCompiledChange = useCallback((html: string, text: string) => {
    setTplHtml(html);
    setTplText(text);
  }, []);

  const editorResetKey = useMemo(
    () => `${activeTplKey}:${tplRevision}`,
    [activeTplKey, tplRevision],
  );

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

  const setThreshold = (key: keyof SettingsThresholds, value: number) => {
    setThresholds((t) => ({ ...t, [key]: value }));
  };

  const showSave =
    activeTab === "monitoring" ||
    activeTab === "detection" ||
    activeTab === "notifications" ||
    activeTab === "ai" ||
    activeTab === "general";

  return (
    <div className="pg">
      <PageHeader
        title="Settings"
        subtitle="Monitoring, detection, notifications, and billing."
        actions={
          showSave ? (
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          ) : undefined
        }
      />

      <nav className="settings-tabs" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={activeTab === t.id ? "on" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <Card loading>
          <EmptyState
            icon="se"
            title="Loading settings"
            description="Fetching shop configuration…"
          />
        </Card>
      ) : (
        <>
          {activeTab === "monitoring" ? (
            <Card>
              <CardTitle
                title="Monitoring"
                subtitle="Inventory verification cadence and refill threshold"
              />
              <div className="field-row">
                <div className="field">
                  <label htmlFor="rec-hours">
                    Inventory verification interval (hours)
                  </label>
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
                <div className="field">
                  <label htmlFor="refill-th">Refill threshold (qty)</label>
                  <input
                    id="refill-th"
                    type="number"
                    min={0}
                    value={refillThreshold}
                    onChange={(e) =>
                      setRefillThreshold(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </div>
              </div>
              <p className="m" style={{ marginBottom: 12 }}>
                When observed quantity at a location is at or below the refill
                threshold, StockSentry opens a refill suggestion (alert only — never
                writes inventory to Shopify).
              </p>
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
          ) : null}

          {activeTab === "detection" ? (
            <Card>
              <CardTitle
                title="Detection rules"
                subtitle="Choose which rules can open incidents for review"
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
                    <span>{ruleTypeLabel(r.ruleType)}</span>
                  </label>
                ))
              )}
            </Card>
          ) : null}

          {activeTab === "notifications" ? (
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
                  {channel === "EMAIL" ? (
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="email-dest">Alert email address</label>
                      <input
                        id="email-dest"
                        type="email"
                        value={prefs.EMAIL.destinationRef}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            EMAIL: {
                              ...p.EMAIL,
                              destinationRef: e.target.value,
                            },
                          }))
                        }
                        placeholder="ops@yourstore.com"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="form-actions">
                <Button disabled={testBusy} onClick={() => void sendTestEmail()}>
                  {testBusy ? "Sending…" : "Send test email"}
                </Button>
              </div>
            </Card>
          ) : null}

          {activeTab === "email" ? (
            <Card>
              <CardTitle
                title="Email templates"
                subtitle="Visual editor — uses {{shopName}}, {{incidentTitle}}, and other template vars"
              />
              <div className="field">
                <label htmlFor="tpl-key">Template</label>
                <select
                  id="tpl-key"
                  value={activeTplKey}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  {(emailTemplates.length
                    ? emailTemplates
                    : [
                        { key: "INCIDENT_ALERT" },
                        { key: "REFILL_ALERT" },
                        { key: "DIGEST" },
                        { key: "TEST" },
                      ]
                  ).map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.key}
                    </option>
                  ))}
                </select>
              </div>
              <EmailTemplateEditor
                templateKey={editorResetKey}
                subject={tplSubject}
                htmlBody={tplHtml}
                textBody={tplText}
                onSubjectChange={setTplSubject}
                onCompiledChange={onCompiledChange}
                onSave={() => void saveTemplate()}
                onSendTest={() => void sendTestEmail()}
                saving={saving}
                testBusy={testBusy}
              />
            </Card>
          ) : null}

          {activeTab === "ai" ? (
            <Card>
              <CardTitle
                title="AI reports"
                subtitle="Plain-language summaries of evidence already on an incident"
              />
              <div className="facts" style={{ marginBottom: 16 }}>
                <div>
                  <small>Used this month</small>
                  <b>
                    {billing?.usage?.aiReportsUsed != null &&
                    billing?.usage?.aiReportsLimit != null
                      ? `${billing.usage.aiReportsUsed} / ${billing.usage.aiReportsLimit}`
                      : "—"}
                  </b>
                </div>
                <div>
                  <small>Plan limit</small>
                  <b>{billing?.usage?.aiReportsLimit ?? "—"}</b>
                </div>
              </div>
              <p className="m" style={{ marginBottom: 12 }}>
                AI reports summarize confirmed evidence already on an incident.
                They never invent inventory facts or change Shopify quantities.
              </p>
            </Card>
          ) : null}

          {activeTab === "billing" ? (
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
          ) : null}

          {activeTab === "general" ? (
            <Card>
              <CardTitle
                title="General"
                subtitle="Shop status and related surfaces"
              />
              <div className="facts" style={{ marginBottom: 16 }}>
                <div>
                  <small>Shop</small>
                  <b>{shop || "—"}</b>
                </div>
                <div>
                  <small>Onboarding</small>
                  <b>{onboardingCompleted ? "Completed" : "In progress"}</b>
                </div>
                <div>
                  <small>Plan</small>
                  <b>{billing?.planSlug ?? "—"}</b>
                </div>
              </div>
              <div className="form-actions">
                <Link href="/bundles" className="btn">
                  Bundle Groups
                </Link>
                <Link
                  href="/onboarding"
                  className={`btn${onboardingCompleted ? "" : " p"}`}
                >
                  {onboardingCompleted
                    ? "Revisit setup checklist"
                    : "Continue setup"}
                </Link>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
