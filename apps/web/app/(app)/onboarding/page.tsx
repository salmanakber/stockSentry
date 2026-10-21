"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type {
  OnboardingChecklistItem,
  OnboardingResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";
import { refreshAppGates } from "../../../lib/gates";

const STEP_HREF: Record<string, string> = {
  baseline: "/products",
  locations: "/products",
  rules: "/settings",
  notifications: "/settings",
  supplier: "/suppliers",
};

export default function OnboardingPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
  const router = useRouter();
  const [checklist, setChecklist] = useState<OnboardingChecklistItem[]>([]);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<OnboardingResponse>("/api/v1/onboarding", {
        shop,
      });
      setChecklist(res?.checklist ?? []);
      setCompleted(Boolean(res?.completed));
      setProgress(res?.progress ?? { done: 0, total: 0 });
    } catch {
      setChecklist([]);
      setCompleted(false);
      setProgress({ done: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [checklist, ready, loading]);

  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const runBaseline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/onboarding/sync", {
        method: "POST",
        shop,
        forceAuthRefresh: true,
      });
      showToast("Inventory sync started — this usually finishes in a minute");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/onboarding/test-notification", {
        method: "POST",
        shop,
      });
      showToast("Test notification sent");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/onboarding/complete", {
        method: "POST",
        shop,
      });
      showToast("Setup complete — welcome to StockSentry");
      setCompleted(true);
      refreshAppGates();
      router.replace("/overview");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Welcome to StockSentry"
        subtitle="A short setup so inventory monitoring can start watching your store."
        actions={
          completed ? (
            <Link href="/overview" className="btn p">
              Go to Overview
            </Link>
          ) : (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void complete()}
            >
              {busy ? "Saving…" : "Mark setup complete"}
            </Button>
          )
        }
      />

      <Card loading={loading}>
        <div className="ob-hero">
          <CardTitle
            title="Setup checklist"
            subtitle={
              progress.total
                ? `${progress.done} of ${progress.total} required steps done${
                    completed ? " · setup complete" : ""
                  }`
                : "Loading progress…"
            }
          />
          <div style={{ minWidth: 140, textAlign: "right" }}>
            <b style={{ fontSize: 28, letterSpacing: "-0.03em" }}>{pct}%</b>
            <div className="m" style={{ fontSize: 12 }}>
              complete
            </div>
          </div>
        </div>
        <div className="ob-progress" aria-hidden>
          <i style={{ width: `${pct}%` }} />
        </div>

        {!checklist.length ? (
          <EmptyState
            icon="he"
            title="Checklist unavailable"
            description="Could not load setup status for this shop. Try again after connecting."
            action={<Button onClick={() => void load()}>Retry</Button>}
          />
        ) : (
          <div className="checklist">
            {checklist.map((item) => {
              const href = STEP_HREF[item.id];
              return (
                <div
                  key={item.id}
                  className={`check-item${item.done ? " done" : ""}`}
                >
                  <span className="mark" aria-hidden>
                    {item.done ? "✓" : ""}
                  </span>
                  <span>
                    {href && !item.done ? (
                      <Link href={href}>{item.label}</Link>
                    ) : (
                      item.label
                    )}
                  </span>
                  {item.optional ? <span className="opt">Optional</span> : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 18 }}>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void runBaseline()}
          >
            Import inventory baseline
          </Button>
          <Button disabled={busy} onClick={() => void sendTest()}>
            Send test notification
          </Button>
          <Link href="/settings" className="btn">
            Open settings
          </Link>
          {completed ? (
            <Link href="/overview" className="btn">
              Back to Overview
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
