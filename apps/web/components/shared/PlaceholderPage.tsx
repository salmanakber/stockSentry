"use client";

import { useEffect } from "react";
import { Card } from "../Card";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
import { useShell } from "../AppShell";
import { useReveal } from "../../hooks/useReveal";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  icon?: string;
}

export function PlaceholderPage({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  icon = "ov",
}: PlaceholderPageProps) {
  const { ready } = useShell();
  useReveal(ready, null, [ready, title]);

  useEffect(() => {
    /* shell already mounted */
  }, []);

  return (
    <div className="pg">
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
        />
      </Card>
    </div>
  );
}
