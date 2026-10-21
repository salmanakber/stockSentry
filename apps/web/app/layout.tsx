import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "../providers";

export const metadata: Metadata = {
  title: "StockSentry",
  description:
    "Monitor inventory changes, investigate suspicious stock movements, and catch potential overselling risks sooner.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiKey =
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ??
    process.env.SHOPIFY_API_KEY ??
    "";

  return (
    <html lang="en">
      <head>
        {/* App Bridge: must be first script, sync load from Shopify CDN (no async/defer/module) */}
        {apiKey ? (
          <>
            <meta name="shopify-api-key" content={apiKey} />
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        ) : null}
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
