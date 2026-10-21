"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Card, CardTitle } from "../../../components/Card";
import { PageHeader } from "../../../components/shared/PageHeader";

const SUPPORT_EMAIL =
  typeof process.env.NEXT_PUBLIC_SUPPORT_EMAIL === "string"
    ? process.env.NEXT_PUBLIC_SUPPORT_EMAIL.trim()
    : "";

type HelpSection = {
  id: string;
  category: string;
  title: string;
  blurb: string;
  keywords: string;
  links: { href: string; label: string }[];
  body: ReactNode;
};

const SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    category: "Getting started",
    title: "Install, connect, and first sync",
    blurb: "Onboarding checklist and what happens after install.",
    keywords: "onboarding install sync connect shopify setup",
    links: [
      { href: "/onboarding", label: "Open onboarding" },
      { href: "/settings?tab=general", label: "General settings" },
      { href: "/products", label: "Inventory" },
    ],
    body: (
      <>
        <p>
          After you install StockSentry from Shopify, complete the onboarding
          checklist: confirm monitoring is connected, run an inventory sync, and
          review detection defaults. Catalog items appear under Inventory only
          after the first sync finishes.
        </p>
        <ul>
          <li>Scopes stay read-only: inventory, products, and locations.</li>
          <li>
            StockSentry never writes quantity, never adjusts stock, and never
            changes orders.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "monitoring",
    category: "Monitoring",
    title: "How inventory is observed",
    blurb: "Webhooks, inventory verification, and incident flags.",
    keywords: "monitoring webhook reconciliation verification incidents rules",
    links: [
      { href: "/settings?tab=monitoring", label: "Monitoring settings" },
      { href: "/settings?tab=detection", label: "Detection rules" },
      { href: "/overview", label: "Overview" },
      { href: "/incidents", label: "Incidents" },
    ],
    body: (
      <>
        <p>
          StockSentry watches inventory quantity updates from Shopify (webhooks
          and scheduled inventory verification), applies detection rules, and
          opens incidents for you to review. An incident is a flag for
          investigation — not proof of theft, error, or a confirmed cause.
        </p>
        <ul>
          <li>
            Quantity updates may arrive late, more than once, or out of order.
          </li>
          <li>
            Sales, returns, transfers, and manual adjustments all move stock —
            StockSentry cannot say which cause produced a change.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "ai-limits",
    category: "AI reports",
    title: "AI limits and what reports can say",
    blurb: "Monthly quota, evidence-only summaries, and plan gates.",
    keywords: "ai report quota limit openai evidence",
    links: [
      { href: "/settings?tab=ai", label: "AI settings" },
      { href: "/billing", label: "Billing & plans" },
    ],
    body: (
      <>
        <p>
          AI reports explain evidence already on the incident. They are never
          the source of truth and may be unavailable when your monthly quota is
          used up. Higher limits require a paid plan (Starter or Pro).
        </p>
      </>
    ),
  },
  {
    id: "bundles",
    category: "Bundle groups",
    title: "Map kits without changing Shopify qty",
    blurb: "Component risk for gift sets and kits.",
    keywords: "bundle group kit gift component refill",
    links: [
      { href: "/bundles", label: "Bundle Groups" },
      { href: "/settings?tab=detection", label: "Refill threshold" },
    ],
    body: (
      <>
        <p>
          Bundle mappings are maintained by your team and may be incomplete.
          When a component has an open incident or low stock, the group is
          highlighted so you can investigate before a kit oversells. StockSentry
          still never writes Shopify quantities.
        </p>
      </>
    ),
  },
  {
    id: "suppliers",
    category: "Suppliers",
    title: "Link suppliers to SKUs",
    blurb: "Context for open risk on attached products.",
    keywords: "supplier vendor lead time attach sku",
    links: [{ href: "/suppliers", label: "Suppliers" }],
    body: (
      <>
        <p>
          Create a supplier, then attach products. Open incidents on those SKUs
          show up on the supplier detail page and contribute to supplier risk on
          Overview.
        </p>
      </>
    ),
  },
  {
    id: "notifications",
    category: "Notifications",
    title: "In-app and email alerts",
    blurb: "Channels, severity floors, and email templates.",
    keywords: "notification email slack alert template digest",
    links: [
      { href: "/notifications", label: "Notifications" },
      { href: "/settings?tab=notifications", label: "Notification prefs" },
      { href: "/settings?tab=email", label: "Email templates" },
    ],
    body: (
      <>
        <p>
          Choose in-app and email channels, minimum severity, and customize
          email templates. CSV exports and higher AI limits require a paid plan.
        </p>
      </>
    ),
  },
  {
    id: "faq",
    category: "FAQ",
    title: "Common questions",
    blurb: "Access, exports, demo mode, and honesty about unknowns.",
    keywords: "faq privacy terms demo csv export unknown quantity",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/exports", label: "Reports / Exports" },
      { href: "/history", label: "Inventory History" },
    ],
    body: (
      <>
        <ul>
          <li>
            <b>What can the app access?</b> Inventory (read), products (read),
            and locations (read). Nothing is written back to Shopify inventory.
          </li>
          <li>
            <b>Why is previous qty unknown?</b> Baseline or first observations
            have no prior quantity to compare. The product detail page labels
            that honestly.
          </li>
          <li>
            <b>What is demo mode?</b>{" "}
            <Link href="/overview?demo=1">?demo=1</Link> shows sample data for
            design QA. It never writes to your shop database.
          </li>
          <li>
            <b>Where do CSV exports live?</b> Paid plans can queue exports from{" "}
            <Link href="/exports">Reports / Exports</Link>.
          </li>
        </ul>
      </>
    ),
  },
];

const CATEGORIES = [
  {
    id: "getting-started",
    title: "Getting started",
    desc: "Onboarding and first sync",
  },
  {
    id: "monitoring",
    title: "Monitoring",
    desc: "Webhooks, verification, incidents",
  },
  { id: "ai-limits", title: "AI reports", desc: "Quota and evidence limits" },
  { id: "bundles", title: "Bundles", desc: "Kit and gift-set mapping" },
  { id: "suppliers", title: "Suppliers", desc: "Vendor risk context" },
  {
    id: "notifications",
    title: "Notifications",
    desc: "Alerts and email templates",
  },
  { id: "faq", title: "FAQ", desc: "Policies and common questions" },
];

export default function HelpPage() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SECTIONS;
    return SECTIONS.filter((s) => {
      const hay = `${s.category} ${s.title} ${s.blurb} ${s.keywords}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q]);

  return (
    <div className="pg help-center">
      <PageHeader
        title="Help & support"
        subtitle="Guides for monitoring, bundles, suppliers, and plan limits."
      />

      <Card className="help-hero">
        <div className="help-hero-copy">
          <CardTitle
            title="Search the help center"
            subtitle="Filter topics by keyword — results update as you type"
          />
          <input
            type="search"
            className="help-search"
            placeholder="Search: bundles, AI quota, webhooks…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search help topics"
          />
        </div>
        <div className="help-hero-actions">
          <Link href="/onboarding" className="btn p">
            Onboarding
          </Link>
          <Link href="/settings?tab=monitoring" className="btn">
            Settings
          </Link>
        </div>
      </Card>

      <div className="help-cats">
        {CATEGORIES.map((c) => (
          <a key={c.id} className="help-cat" href={`#${c.id}`}>
            <b>{c.title}</b>
            <span>{c.desc}</span>
          </a>
        ))}
      </div>

      {!filtered.length ? (
        <Card>
          <EmptyHelp q={q} onClear={() => setQ("")} />
        </Card>
      ) : (
        filtered.map((s) => (
          <div key={s.id} id={s.id} className="help-sec-card">
            <Card>
              <div className="help-sec">
                <CardTitle title={s.title} subtitle={s.category} />
                {s.body}
                <div className="help-links">
                  {s.links.map((l) => (
                    <Link key={l.href + l.label} href={l.href} className="btn">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        ))
      )}

      <Card>
        <div className="help-sec" style={{ marginBottom: 0 }}>
          <CardTitle title="Contact support" subtitle="Email only" />
          {SUPPORT_EMAIL ? (
            <p>
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your
              shop domain and incident ID when asking about a specific flag.
            </p>
          ) : (
            <p>
              Support email is not configured for this environment. Use your
              Shopify app listing support channel, or set{" "}
              <span className="mono">NEXT_PUBLIC_SUPPORT_EMAIL</span> for this
              deployment.
            </p>
          )}
          <p>
            <Link href="/privacy">Privacy policy</Link>
            {" · "}
            <Link href="/terms">Terms of service</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

function EmptyHelp({ q, onClear }: { q: string; onClear: () => void }) {
  return (
    <div className="help-sec" style={{ marginBottom: 0 }}>
      <h2>No topics match “{q}”</h2>
      <p>Try another keyword, or clear the search to see all sections.</p>
      <button type="button" className="btn" onClick={onClear}>
        Clear search
      </button>
    </div>
  );
}
