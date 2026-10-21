"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ConnectGate } from "../../components/ConnectGate";
import { useShop } from "../../providers";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, authError, beginInstall } = useShop();
  const searchParams = useSearchParams();
  const router = useRouter();
  const demo = searchParams.get("demo") === "1";
  const hasShopifyContext = Boolean(
    searchParams.get("shop") ||
      searchParams.get("host") ||
      searchParams.get("embedded") === "1",
  );

  useEffect(() => {
    if (!ready) return;
    if (authenticated || demo || hasShopifyContext) return;
    router.replace("/");
  }, [ready, authenticated, demo, hasShopifyContext, router]);

  if (!ready) {
    return (
      <ConnectGate message="Starting StockSentry…" showConnect={false} />
    );
  }

  if (authenticated || demo) {
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
