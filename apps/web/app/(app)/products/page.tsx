"use client";

import { PlaceholderPage } from "../../../components/shared/PlaceholderPage";

export default function ProductsPage() {
  return (
    <PlaceholderPage
      title="Products & Locations"
      subtitle="Catalog items and locations under inventory monitoring."
      icon="pr"
      emptyTitle="No products loaded"
      emptyDescription="Products and locations sync from Shopify after install. Nothing is listed until the first catalog sync completes."
    />
  );
}
