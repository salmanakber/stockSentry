import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="legal">
      <h1>Terms</h1>
      <p>
        StockSentry is provided as a read-only inventory monitoring tool.
        Flags and AI explanations are informational and do not constitute proof
        of error, fraud, or required action. You remain responsible for
        inventory accuracy in Shopify.
      </p>
      <p>
        Use of the app is subject to Shopify’s Partner and App Store terms in
        addition to any merchant agreement with the app publisher.
      </p>
      <p>
        <Link href="/" style={{ color: "var(--acc)", fontWeight: 600 }}>
          Back to app
        </Link>
      </p>
    </div>
  );
}
