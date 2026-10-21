import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="legal">
      <h1>Privacy</h1>
      <p>
        StockSentry processes inventory and product data from your Shopify
        store solely to monitor stock changes and surface potential overselling
        risks. We do not modify inventory. Access tokens are stored for your
        shop session and used only to call Shopify APIs required by the app.
      </p>
      <p>
        Contact your app administrator for data deletion or export requests
        related to your shop.
      </p>
      <p>
        <Link href="/" style={{ color: "var(--acc)", fontWeight: 600 }}>
          Back to app
        </Link>
      </p>
    </div>
  );
}
