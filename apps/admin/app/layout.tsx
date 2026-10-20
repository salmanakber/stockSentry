import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../components/AuthGate";

export const metadata: Metadata = {
  title: "Bundle Safety Admin",
  description: "Platform administration for Bundle Safety / StockSentry",
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
