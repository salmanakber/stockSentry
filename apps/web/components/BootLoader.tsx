"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const STEPS = [
  "Verifying Shopify session",
  "Loading inventory observations",
  "Applying detection rules",
  "Checking data freshness",
];

interface BootLoaderProps {
  onDone: () => void;
  /** Skip animation when auth already completed a prior boot this session */
  skip?: boolean;
}

export function BootLoader({ onDone, skip = false }: BootLoaderProps) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [label, setLabel] = useState("Starting up");
  const [labelOpacity, setLabelOpacity] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (skip) {
      onDone();
      return;
    }

    let cancelled = false;
    let li = 0;

    const fin = () => {
      if (cancelled) return;
      setOut(true);
      window.setTimeout(
        () => {
          if (!cancelled) onDone();
        },
        reduced ? 0 : 900,
      );
    };

    const adv = () => {
      if (cancelled) return;
      if (li >= STEPS.length) {
        window.setTimeout(fin, reduced ? 0 : 380);
        return;
      }
      setLabelOpacity(0);
      window.setTimeout(
        () => {
          if (cancelled) return;
          setLabel(STEPS[li]!);
          setLabelOpacity(1);
          setProgress(((li + 1) / STEPS.length) * 100);
          setStepIndex(li + 1);
          li += 1;
          window.setTimeout(adv, reduced ? 40 : 520);
        },
        reduced ? 0 : 170,
      );
    };

    const start = window.setTimeout(adv, reduced ? 0 : 1300);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [onDone, reduced, skip]);

  if (skip) return null;

  return (
    <div id="ld" className={out ? "out" : undefined} aria-busy={!out}>
      <div className="lgo">
        <img src="/images/logo-icon.png" alt="" />
      </div>
      <div className="lw">
        {"StockSentry".split("").map((c, i) => (
          <span key={i} style={{ ["--i" as string]: i }}>
            {c === " " ? "\u00a0" : c}
          </span>
        ))}
      </div>
      <div className="lb2">
        <div className="pb">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="lt">
          <span style={{ opacity: labelOpacity }}>{label}</span>
          <span className="mono">
            {String(stepIndex).padStart(2, "0")} / 04
          </span>
        </div>
      </div>
    </div>
  );
}
