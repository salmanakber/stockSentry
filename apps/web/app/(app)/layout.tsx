"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ConnectGate } from "../../components/ConnectGate";
import { useShop } from "../../providers";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, authError, beginInstall } = useShop();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const router = useRouter();

  useEffect(() => {
    // Preserve demo flag across in-app navigation when present
    if (!demo) return;
  }, [demo, router]);

  if (!ready) {
    return (
      <ConnectGate
        message="Starting Bundle Safety…"
        showConnect={false}
      />
    );
  }

  if (!authenticated && !demo) {
    return (
      <ConnectGate
        message={
          authError ??
          "Open Bundle Safety from Shopify Admin to connect your store."
        }
        onConnect={beginInstall}
      />
    );
  }

  return <AppShell demo={demo}>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <ConnectGate message="Starting Bundle Safety…" showConnect={false} />
      }
    >
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}
