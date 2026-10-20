"use client";

import { Card, CardTitle } from "../../../components/Card";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Icon } from "../../../components/IconSprite";
import { useShell } from "../../../components/AppShell";
import { useReveal } from "../../../hooks/useReveal";

export default function HelpPage() {
  const { ready } = useShell();
  useReveal(ready, null, [ready]);

  return (
    <div className="pg">
      <PageHeader
        title="Help"
        subtitle="How Bundle Safety reads inventory and surfaces incidents."
      />
      <Card>
        <CardTitle
          title="Read-only monitoring"
          subtitle="Scopes: read_inventory, read_products"
        />
        <div className="note" style={{ marginTop: 0, maxWidth: "none" }}>
          <Icon id="sh" />
          <div>
            Bundle Safety never changes your inventory. Quantities are
            observations and may be delayed or out of order. Deterministic
            rules flag suspicious changes; AI only explains evidence and is
            never the source of truth.
          </div>
        </div>
      </Card>
    </div>
  );
}
