"use client";

import Link from "next/link";
import { Card, CardTitle } from "../Card";
import { Icon } from "../IconSprite";
import { EmptyState } from "../shared/EmptyState";
import type { PipelineNode } from "../../lib/types";

interface DataPipelineProps {
  nodes?: PipelineNode[] | null;
  loading?: boolean;
}

export function DataPipeline({ nodes, loading = false }: DataPipelineProps) {
  return (
    <Card loading={loading}>
      <CardTitle
        title="Data pipeline · last 24 hours"
        subtitle="From Shopify webhook to notification. Deterministic rules run before any AI."
        action={<Link href="/settings">Monitoring settings</Link>}
      />
      {!nodes?.length ? (
        <EmptyState
          icon="db"
          title="Pipeline idle"
          description="Counts for webhooks, storage, rules, and notifications appear after traffic flows through."
        />
      ) : (
        <div className="pp">
          {nodes.map((p, i) => (
            <span key={p.label} style={{ display: "contents" }}>
              <div className="nd" style={{ ["--k" as string]: i }}>
                <div className="ic">
                  <Icon id={p.icon} />
                </div>
                <b>{p.value}</b>
                <span>{p.label}</span>
              </div>
              {i < nodes.length - 1 ? (
                <div className="cn" style={{ ["--k" as string]: i }}>
                  <i />
                </div>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
