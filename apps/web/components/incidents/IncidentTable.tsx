"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "../IconSprite";
import { ProductThumb } from "../ProductThumb";
import {
  isDeltaNegative,
  severityClass,
  severityLabel,
  statusColor,
  statusLabel,
} from "../../lib/format";
import type { IncidentRow } from "../../lib/types";

interface IncidentTableProps {
  items: IncidentRow[];
  /** When true, title links to detail page */
  linkTitles?: boolean;
}

export function IncidentTable({
  items,
  linkTitles = true,
}: IncidentTableProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="tw">
      <div className="tb">
        <div className="th">
          <span>Severity</span>
          <span>Item · location</span>
          <span>Quantity</span>
          <span>Rule</span>
          <span>Source</span>
          <span>Status</span>
          <span>Detected</span>
          <span />
        </div>
        {items.map((r) => {
          const open = openId === r.id;
          const sev = severityClass(r.severity);
          const sevText = r.severityLabel ?? severityLabel(r.severity);
          const stColor = r.statusColor ?? statusColor(r.status);
          const deltaNeg = isDeltaNegative(r.quantityDelta);

          return (
            <div className={`ir${open ? " open" : ""}`} key={r.id}>
              <div
                className="rh"
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(open ? null : r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(open ? null : r.id);
                  }
                }}
              >
                <span className={`sev ${sev}`}>{sevText}</span>
                <div className="inv-prod">
                  <ProductThumb src={r.imageUrl} label={r.title} size="sm" />
                  <div className="inv-prod-meta">
                    <b>
                      {linkTitles ? (
                        <Link
                          href={`/incidents/${encodeURIComponent(r.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {r.title}
                        </Link>
                      ) : (
                        r.title
                      )}
                    </b>
                    <span className="m mono">{r.subtitle}</span>
                  </div>
                </div>
                <div className="q">
                  {r.quantity}
                  {r.quantityDelta ? (
                    <small className={deltaNeg ? "d" : undefined}>
                      {r.quantityDelta}
                    </small>
                  ) : null}
                </div>
                <div className="ru">
                  {r.rule}
                  {r.ruleDetail ? <small>{r.ruleDetail}</small> : null}
                </div>
                <span className="ch">{r.source}</span>
                <span className="st">
                  <i style={{ background: stColor }} />
                  {statusLabel(r.status)}
                </span>
                <span className="m" style={{ color: "var(--mut)", fontSize: 12 }}>
                  {r.detectedAt}
                </span>
                <Icon id="ch" />
              </div>
              <div className="ev">
                <div>
                  <div className="evi">
                    <div className="c">
                      <em>Confirmed</em>
                      <p>{r.evidence?.confirmed ?? "—"}</p>
                    </div>
                    <div className="u">
                      <em>Unknown</em>
                      <p>{r.evidence?.unknown ?? "—"}</p>
                    </div>
                    <div className="n">
                      <em>Suggested check</em>
                      <p>{r.evidence?.suggested ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
