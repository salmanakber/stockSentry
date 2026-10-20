"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectGate } from "../components/ConnectGate";
import { useShop } from "../providers";

function HomeInner() {
  const { ready, authenticated, authError, beginInstall } = useShop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";

  useEffect(() => {
    if (!ready) return;
    if (authenticated || demo) {
      const qs = demo ? "?demo=1" : "";
      router.replace(`/overview${qs}`);
    }
  }, [ready, authenticated, demo, router]);

  if (!ready) {
    return (
      <ConnectGate message="Starting Bundle Safety…" showConnect={false} />
    );
  }

  if (authenticated || demo) {
    return (
      <ConnectGate message="Opening overview…" showConnect={false} />
    );
  }

  return (
    <ConnectGate
      message={
        authError ??
        "Open Bundle Safety from Shopify Admin (Apps → Bundle Safety), or connect your shop to begin."
      }
      onConnect={beginInstall}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <ConnectGate message="Starting Bundle Safety…" showConnect={false} />
      }
    >
      <HomeInner />
    </Suspense>
  );
}
