"use client";

import { Card } from "../Card";
import type { KpiSpark } from "../../lib/types";
import { EmptyState } from "../shared/EmptyState";

function sparkPath(values: number[]): string {
  if (!values.length) return "";
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const range = mx - mn || 1;
  return values
    .map((v, i) => {
      const x = i * 13;
      const y = 26 - ((v - mn) / range) * 24;
      return `${i ? "L" : "M"}${x} ${y}`;
    })
    .join("");
}

interface KpiGridProps {
  items?: KpiSpark[] | null;
  loading?: boolean;
}

export function KpiGrid({ items, loading = false }: KpiGridProps) {
  if (!items?.length) {
    return (
      <section className="kp">
        <Card loading={loading} style={{ gridColumn: "1 / -1" }}>
          <EmptyState
            icon="ov"
            title="No KPI metrics yet"
            description="KPIs appear after inventory observations and detection rules have run for this shop."
          />
        </Card>
      </section>
    );
  }

  return (
    <section className="kp">
      {items.map((x, i) => (
        <Card
          key={x.label}
          className="k hv"
          hover
          loading={loading}
          style={{ ["--d" as string]: `${i * 80}ms` }}
        >
          <div className="l">
            <i style={{ background: x.color }} />
            {x.label}
          </div>
          <div className="v" data-n={x.value}>
            0
          </div>
          <div className="s">
            <span>{x.subtitle}</span>
            {x.sparkline?.length ? (
              <svg viewBox="0 0 80 28">
                <path
                  className="dr"
                  pathLength={1}
                  d={sparkPath(x.sparkline)}
                  stroke={x.stroke}
                />
              </svg>
            ) : null}
          </div>
        </Card>
      ))}
    </section>
  );
}
