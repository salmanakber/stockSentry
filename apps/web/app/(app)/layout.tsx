"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ConnectGate } from "../../components/ConnectGate";
import { PlanPicker } from "../../components/PlanPicker";
import { apiRequest } from "../../lib/api";
import { GATES_REFRESH_EVENT } from "../../lib/gates";
import type { BillingStatusResponse, OnboardingResponse } from "../../lib/types";
import { useShop } from "../../providers";

const PLAN_GATE_ALLOW = new Set(["/billing", "/help"]);
const ONBOARDING_ALLOW = new Set([
  "/onboarding",
  "/settings",
  "/help",
  "/billing",
]);

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, authError, beginInstall, shop } = useShop();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const demo = searchParams.get("demo") === "1";
  const hasShopifyContext = Boolean(
    searchParams.get("shop") ||
      searchParams.get("host") ||
      searchParams.get("embedded") === "1",
  );

  const [planGate, setPlanGate] = useState<"loading" | "required" | "ok">(
    "loading",
  );
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const initialLoad = useRef(true);

  const refreshGates = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!authenticated || demo) {
        setPlanGate("ok");
        setOnboardingDone(true);
        return;
      }
      if (!opts?.silent && initialLoad.current) {
        setPlanGate("loading");
      }
      try {
        const [billing, onboarding] = await Promise.all([
          apiRequest<BillingStatusResponse>("/api/v1/billing/status", {
            shop,
          }).catch(() =>
            apiRequest<BillingStatusResponse>("/api/v1/billing", { shop }),
          ),
          apiRequest<OnboardingResponse>("/api/v1/onboarding", { shop }).catch(
            () => null,
          ),
        ]);
        setPlanGate(billing?.requiresPlanSelection ? "required" : "ok");
        setOnboardingDone(Boolean(onboarding?.completed));
      } catch {
        // Fail open so a flaky billing call does not brick the shell forever.
        setPlanGate("ok");
        setOnboardingDone(true);
      } finally {
        initialLoad.current = false;
      }
    },
    [authenticated, demo, shop],
  );

  useEffect(() => {
    if (!ready) return;
    if (authenticated || demo || hasShopifyContext) return;
    router.replace("/");
  }, [ready, authenticated, demo, hasShopifyContext, router]);

  useEffect(() => {
    if (!ready || !(authenticated || demo)) return;
    void refreshGates();
  }, [ready, authenticated, demo, refreshGates]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshGates({ silent: true });
    };
    window.addEventListener(GATES_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GATES_REFRESH_EVENT, onRefresh);
  }, [refreshGates]);

  useEffect(() => {
    if (planGate !== "ok") return;
    if (onboardingDone !== false) return;
    if (demo) return;
    if (ONBOARDING_ALLOW.has(pathname)) return;
    router.replace("/onboarding");
  }, [planGate, onboardingDone, demo, pathname, router]);

  if (!ready) {
    return (
      <ConnectGate message="Starting StockSentry…" showConnect={false} />
    );
  }

  if (authenticated || demo) {
    if (!demo && planGate === "loading") {
      return (
        <ConnectGate message="Checking your plan…" showConnect={false} />
      );
    }

    if (!demo && planGate === "required") {
      if (PLAN_GATE_ALLOW.has(pathname)) {
        return <AppShell demo={demo}>{children}</AppShell>;
      }
      return (
        <PlanPicker
          onSelected={() => {
            window.dispatchEvent(new Event(GATES_REFRESH_EVENT));
          }}
        />
      );
    }

    return <AppShell demo={demo}>{children}</AppShell>;
  }

  if (hasShopifyContext) {
    return (
      <ConnectGate
        message={
          authError ??
          "Open StockSentry from Shopify Admin to connect your store."
        }
        onConnect={beginInstall}
      />
    );
  }

  return (
    <ConnectGate message="Opening StockSentry…" showConnect={false} />
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <ConnectGate message="Starting StockSentry…" showConnect={false} />
      }
    >
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}
