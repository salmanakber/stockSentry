"use client";

import { Card, CardTitle } from "../Card";
import { EmptyState } from "../shared/EmptyState";
import type { AiReportsSummary } from "../../lib/types";

interface AiReportsCardProps {
  data?: AiReportsSummary | null;
  loading?: boolean;
}

export function AiReportsCard({ data, loading = false }: AiReportsCardProps) {
  if (!data) {
    return (
      <Card hover loading={loading}>
        <CardTitle
          title="AI incident reports"
          subtitle="Explains the evidence; never the source of truth"
        />
        <EmptyState
          icon="zp"
          title="No AI reports this month"
          description="Eligible incidents can generate cached explanations once detection evidence is available."
        />
      </Card>
    );
  }

  const pct = data.limit > 0 ? Math.round((data.used / data.limit) * 100) : 0;

  return (
    <Card hover loading={loading}>
      <CardTitle
        title="AI incident reports"
        subtitle="Explains the evidence; never the source of truth"
      />
      <div className="ai">
        <div className="ring" style={{ ["--v" as string]: pct }}>
          <svg viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="#eef0f4"
              pathLength={100}
            />
            <circle
              className="fg"
              cx="50"
              cy="50"
              r="42"
              pathLength={100}
            />
          </svg>
          <b data-n={data.used}>0</b>
        </div>
        <p>
          <strong>
            {data.used} of {data.limit} this month
          </strong>
          Reports are cached while evidence is unchanged.
        </p>
      </div>
      <div className="lc">
        <div>
          <b>{data.generated}</b>Generated
        </div>
        <div>
          <b>{data.queued}</b>Queued
        </div>
        <div>
          <b>{data.stale}</b>Stale · evidence changed
        </div>
        <div>
          <b>{data.failed}</b>Failed · retryable
        </div>
      </div>
    </Card>
  );
}
