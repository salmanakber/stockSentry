import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../components/AuthGate";

export const metadata: Metadata = {
  title: "StockSentry Admin",
  description: "Platform administration for StockSentry",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
