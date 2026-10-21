"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectGate } from "../components/ConnectGate";

const SHOPIFY_PARTNERS =
  "https://partners.shopify.com/";

function MarketingHome() {
  return (
    <div className="mkt">
      <div className="mkt-hero">
        <div className="mkt-brand">
          <div className="mk" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <span>StockSentry</span>
        </div>
        <h1>Catch inventory surprises before they become oversells.</h1>
        <p>
          Read-only Shopify monitoring that flags unusual stock moves so your
          team can investigate faster.
        </p>
        <div className="mkt-cta">
          <a
            className="btn p"
            href={SHOPIFY_PARTNERS}
            target="_blank"
            rel="noreferrer"
          >
            Install on Shopify
          </a>
          <Link className="btn" href="/overview?demo=1">
            View demo
          </Link>
        </div>
      </div>

      <section className="mkt-features">
        <h2>Built for inventory ops</h2>
        <p className="mkt-lead">
          Observe quantities, open incidents, and review evidence — without
          writing to your catalog.
        </p>
        <ul>
          <li>
            <b>Incident detection</b>
            <span>
              Deterministic rules on quantity jumps, repeats, and threshold
              breaches.
            </span>
          </li>
          <li>
            <b>Bundle awareness</b>
            <span>
              Spot component risk that can take bundled products offline.
            </span>
          </li>
          <li>
            <b>Read-only by design</b>
            <span>
              Scopes stay on read_inventory and read_products — never adjusts
              stock.
            </span>
          </li>
        </ul>
      </section>

      <footer className="mkt-foot">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/overview?demo=1">Demo</Link>
      </footer>
    </div>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const host = searchParams.get("host");
  const demo = searchParams.get("demo") === "1";

  useEffect(() => {
    if (demo) {
      router.replace("/overview?demo=1");
      return;
    }
    if (shop || host) {
      const qs = searchParams.toString();
      router.replace(`/overview${qs ? `?${qs}` : ""}`);
    }
  }, [shop, host, demo, router, searchParams]);

  if (shop || host || demo) {
    return (
      <ConnectGate message="Opening StockSentry…" showConnect={false} />
    );
  }

  return <MarketingHome />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <ConnectGate message="Starting StockSentry…" showConnect={false} />
      }
    >
      <HomeInner />
    </Suspense>
  );
}
