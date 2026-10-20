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
  OnboardingChecklistItem,
  OnboardingResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

export default function OnboardingPage() {
  const { shop } = useShop();
  const { ready } = useShell();
  const { showToast } = useToast();
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

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/onboarding/complete", {
        method: "POST",
        shop,
      });
      showToast("Onboarding marked complete");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pg">
      <PageHeader
        title="Onboarding"
        subtitle="Checklist to get Bundle Safety monitoring ready."
        actions={
          <>
            <Link href="/products" className="btn">
              Sync inventory
            </Link>
            <Link href="/settings" className="btn">
              Settings
            </Link>
            <Button
              variant="primary"
              disabled={busy || completed}
              onClick={() => void complete()}
            >
              {completed ? "Completed" : busy ? "Saving…" : "Mark complete"}
            </Button>
          </>
        }
      />

      <Card loading={loading}>
        <CardTitle
          title="Setup checklist"
          subtitle={
            progress.total
              ? `${progress.done} of ${progress.total} done${
                  completed ? " · onboarding complete" : ""
                }`
              : "Loading progress…"
          }
        />
        {!checklist.length ? (
          <EmptyState
            icon="he"
            title="Checklist unavailable"
            description="Could not load onboarding status for this shop. Try again after connecting."
            action={<Button onClick={() => void load()}>Retry</Button>}
          />
        ) : (
          <div className="checklist">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`check-item${item.done ? " done" : ""}`}
              >
                <span className="mark" aria-hidden>
                  {item.done ? "✓" : ""}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="form-actions" style={{ marginTop: 18 }}>
          <Link href="/products" className="btn p">
            Run sync
          </Link>
          <Link href="/settings" className="btn">
            Configure rules & notifications
          </Link>
        </div>
      </Card>
    </div>
  );
}
