"use client";

import Link from "next/link";
import { Card, CardTitle } from "../../../components/Card";
import { PageHeader } from "../../../components/shared/PageHeader";

export default function HelpPage() {
  return (
    <div className="pg">
      <PageHeader
        title="Help"
        subtitle="How StockSentry works, what it can see, and how to get support."
      />

      <Card>
        <div className="help-sec">
          <CardTitle
            title="What StockSentry does"
            subtitle="Read-only inventory monitoring and incident review"
          />
          <p>
            StockSentry watches inventory quantity updates from Shopify
            (webhooks and scheduled inventory verification), applies detection
            rules, and opens incidents for you to review. An incident is a flag
            for investigation — not proof of theft, error, or a confirmed cause.
          </p>
        </div>

        <div className="help-sec">
          <h2>What the app can access</h2>
          <ul>
            <li>
              <b>Inventory (read)</b> — observe available quantities and locations
            </li>
            <li>
              <b>Products (read)</b> — resolve product titles, variants, and SKUs
            </li>
          </ul>
          <p>
            The app never writes inventory, never adjusts stock, and never
            changes orders or fulfillments.
          </p>
        </div>

        <div className="help-sec">
          <h2>Things to keep in mind</h2>
          <ul>
            <li>
              Quantity updates may arrive late, more than once, or out of order.
            </li>
            <li>
              Sales, returns, transfers, and manual adjustments all move stock —
              StockSentry cannot say which cause produced a change.
            </li>
            <li>
              Bundle mappings are maintained by your team and may be incomplete.
            </li>
            <li>
              AI reports explain evidence already on the incident; they are never
              the source of truth and may be unavailable when your monthly quota
              is used up.
            </li>
            <li>
              CSV exports and higher AI limits require a paid plan (Starter or
              Pro).
            </li>
          </ul>
        </div>

        <div className="help-sec">
          <h2>Policies</h2>
          <p>
            <Link href="/privacy">Privacy policy</Link>
            {" · "}
            <Link href="/terms">Terms of service</Link>
          </p>
        </div>

        <div className="help-sec" style={{ marginBottom: 0 }}>
          <h2>Support</h2>
          <p>
            Email{" "}
            <a href="mailto:support@stocksentry.app">support@stocksentry.app</a>{" "}
            with your shop domain and incident ID when asking about a specific
            flag.
          </p>
        </div>
      </Card>
    </div>
  );
}
