"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";
import { Card, CardTitle } from "../Card";
import type { TrendPoint } from "../../lib/types";
import { EmptyState } from "../shared/EmptyState";

const W = 640;
const H = 240;
const PL = 22;
const PR = 6;
const PT = 8;
const PB = 26;

function smooth(points: [number, number][]): string {
  if (!points.length) return "";
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i - 1] || points[i]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const e = points[i + 2] || c;
    d += ` C${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6},${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6},${c[0]} ${c[1]}`;
  }
  return d;
}

interface IncidentTrendChartProps {
  points?: TrendPoint[] | null;
  loading?: boolean;
  subtitle?: string;
}

export function IncidentTrendChart({
  points,
  loading = false,
  subtitle,
}: IncidentTrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    i: number;
    left: string;
    top: string;
  } | null>(null);

  const data = points ?? [];
  const n = Math.max(data.length - 1, 1);
  const st = (W - PL - PR) / n;
  const maxY = Math.max(6, ...data.map((p) => Math.max(p.detected, p.closed)));

  const X = useCallback((i: number) => PL + i * st, [st]);
  const Y = useCallback(
    (v: number) => H - PB - (v / maxY) * (H - PB - PT),
    [maxY],
  );

  const paths = useMemo(() => {
    if (!data.length) return null;
    const pd = data.map((p, i) => [X(i), Y(p.detected)] as [number, number]);
    const pq = data.map((p, i) => [X(i), Y(p.closed)] as [number, number]);
    return { detected: smooth(pd), closed: smooth(pq), pd, pq };
  }, [data, X, Y]);

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!svgRef.current || !data.length) return;
    const b = svgRef.current.getBoundingClientRect();
    const cx =
      "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const i = Math.max(
      0,
      Math.min(
        data.length - 1,
        Math.round(((cx - b.left) / b.width) * W - PL) / st,
      ),
    );
    const idx = Math.round(i);
    setHover({
      i: idx,
      left: `${(X(idx) / W) * 100}%`,
      top: `${(Y(data[idx]!.detected) / H) * b.height - 48}px`,
    });
  };

  const rangeLabel =
    subtitle ??
    (data.length
      ? `Detected versus closed per day · ${data[0]!.label} – ${data[data.length - 1]!.label}`
      : "Detected versus closed per day");

  return (
    <Card loading={loading}>
      <CardTitle
        title="Incident trend"
        subtitle={rangeLabel}
        action={
          data.length ? (
            <div className="leg">
              <span>
                <i style={{ background: "var(--acc)" }} />
                Detected
              </span>
              <span>
                <i style={{ background: "#b8c0cc" }} />
                Closed
              </span>
            </div>
          ) : null
        }
      />
      {!data.length || !paths ? (
        <EmptyState
          icon="hi"
          title="No trend data"
          description="Daily detected and closed counts will appear here once incidents exist."
        />
      ) : (
        <div className="cw">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            onMouseMove={onMove}
            onTouchMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#008060" stopOpacity=".16" />
                <stop offset="1" stopColor="#008060" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: Math.floor(maxY / 2) + 1 }, (_, gi) => {
              const g = gi * 2;
              const y = Y(g);
              return (
                <g key={g}>
                  <line
                    x1={PL}
                    x2={W - PR}
                    y1={y}
                    y2={y}
                    stroke="#f0f2f5"
                  />
                  <text x={0} y={y + 4}>
                    {g}
                  </text>
                </g>
              );
            })}
            {data
              .map((p, i) => ({ p, i }))
              .filter(({ i }) =>
                [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n].includes(i),
              )
              .map(({ p, i }) => (
                <text
                  key={p.date}
                  x={X(i)}
                  y={H - 6}
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              ))}
            <path
              className="fa"
              d={`${paths.detected} L${X(data.length - 1)} ${Y(0)} L${X(0)} ${Y(0)}Z`}
              fill="url(#g)"
            />
            <path
              className="dr"
              pathLength={1}
              d={paths.closed}
              stroke="#b8c0cc"
            />
            <path
              className="dr"
              pathLength={1}
              d={paths.detected}
              stroke="#008060"
              style={{ strokeWidth: 3 }}
            />
            <g style={{ opacity: hover ? 1 : 0, transition: "opacity .2s" }}>
              {hover ? (
                <>
                  <line
                    x1={X(hover.i)}
                    x2={X(hover.i)}
                    y1={PT}
                    y2={H - PB}
                    stroke="#d0d5dd"
                    strokeDasharray="3 4"
                  />
                  <circle
                    cx={X(hover.i)}
                    cy={Y(data[hover.i]!.detected)}
                    r={5.5}
                    fill="#fff"
                    stroke="#008060"
                    strokeWidth={2.8}
                  />
                  <circle
                    cx={X(hover.i)}
                    cy={Y(data[hover.i]!.closed)}
                    r={4}
                    fill="#fff"
                    stroke="#b8c0cc"
                    strokeWidth={2.4}
                  />
                </>
              ) : null}
            </g>
            <rect width={W} height={H} fill="transparent" />
          </svg>
          <div
            className="tip"
            style={
              hover
                ? { opacity: 1, left: hover.left, top: hover.top }
                : { opacity: 0 }
            }
          >
            {hover ? (
              <>
                <b>{data[hover.i]!.label}</b>
                {data[hover.i]!.detected} detected · {data[hover.i]!.closed}{" "}
                closed
              </>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
