"use client";

import { Card } from "../Card";
import { healthIndex, healthLabel } from "../../lib/format";
import type { MonitoringStatus } from "../../lib/types";

const TRACK = ["Healthy", "Delayed", "Degraded", "Disconnected"] as const;

interface MonitoringStatusCardProps {
  data?: MonitoringStatus | null;
  loading?: boolean;
  lastReconciliationOverride?: string | null;
}

export function MonitoringStatusCard({
  data,
  loading = false,
  lastReconciliationOverride,
}: MonitoringStatusCardProps) {
  if (!data) {
    return (
      <Card className="stt" style={{ ["--d" as string]: "60ms" }} loading={loading}>
        <div>
          <div className="sh">
            <span className="pls" />
            Waiting for monitoring data
          </div>
          <div className="trk">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="tl">
            {TRACK.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="facts">
            <div>
              <small>Last reconciliation</small>
              <b>—</b>
            </div>
            <div>
              <small>Next reconciliation</small>
              <b>—</b>
            </div>
            <div>
              <small>Last webhook received</small>
              <b>—</b>
            </div>
          </div>
          <p style={{ margin: "12px 0 0", color: "var(--mut)", fontSize: 13 }}>
            Connect inventory webhooks and run an initial reconciliation to
            populate this panel.
          </p>
        </div>
      </Card>
    );
  }

  const idx = healthIndex(data.status);
  const lastRec =
    lastReconciliationOverride ?? data.lastReconciliation ?? "—";
  const sources = data.sources ?? [];

  return (
    <Card className="stt" style={{ ["--d" as string]: "60ms" }} loading={loading}>
      <div>
        <div className="sh">
          <span className="pls" />
          {healthLabel(data.status)}
        </div>
        <div className="trk">
          {TRACK.map((_, i) => (
            <i key={TRACK[i]} className={i === idx ? "on" : undefined} />
          ))}
        </div>
        <div className="tl">
          {TRACK.map((t, i) => (
            <span key={t} className={i === idx ? "on" : undefined}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="facts">
          <div>
            <small>Last reconciliation</small>
            <b id="lr">{lastRec}</b>
          </div>
          <div>
            <small>Next (6 h interval)</small>
            <b>{data.nextReconciliation ?? "—"}</b>
          </div>
          <div>
            <small>Last webhook received</small>
            <b>{data.lastWebhook ?? "—"}</b>
          </div>
        </div>
        {sources.length > 0 ? (
          <>
            <div className="src">
              {sources.map((s, i) => (
                <i
                  key={s.label}
                  style={{
                    ["--f" as string]: s.pct,
                    ["--k" as string]: i,
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <div className="sg">
              {sources.map((s) => (
                <span key={s.label}>
                  <i style={{ background: s.color }} />
                  {s.label} {s.pct}%
                </span>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
