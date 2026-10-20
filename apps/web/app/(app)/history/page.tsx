"use client";

import { PlaceholderPage } from "../../../components/shared/PlaceholderPage";

export default function HistoryPage() {
  return (
    <PlaceholderPage
      title="Inventory History"
      subtitle="Observed quantity changes across products and locations."
      icon="hi"
      emptyTitle="No history yet"
      emptyDescription="Inventory observations from webhooks and reconciliations will appear here once monitoring is active."
    />
  );
}
