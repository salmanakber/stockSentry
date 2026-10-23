"use client";

import Link from "next/link";
import { useEffect } from "react";

export interface UpgradeFeatureInfo {
  href: string;
  label: string;
  title: string;
  body: string;
  requiredPlan: string;
}

interface UpgradeFeatureModalProps {
  feature: UpgradeFeatureInfo | null;
  onClose: () => void;
}

export function UpgradeFeatureModal({
  feature,
  onClose,
}: UpgradeFeatureModalProps) {
  useEffect(() => {
    if (!feature) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [feature, onClose]);

  if (!feature) return null;

  return (
    <div
      className="upg-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="upg-card">
        <div className="upg-glow" aria-hidden />
        <button
          type="button"
          className="upg-x"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="upg-mark">
          <img src="/images/logo-icon.png" alt="" />
        </div>
        <span className="upg-chip">{feature.requiredPlan} plan</span>
        <h2 id="upg-title">{feature.title}</h2>
        <p>{feature.body}</p>
        <p className="upg-note">
          You can still browse <strong>{feature.label}</strong> — upgrade when
          you are ready to unlock the full workflow.
        </p>
        <div className="upg-actions">
          <button type="button" className="btn" onClick={onClose}>
            Continue browsing
          </button>
          <Link href="/billing" className="btn primary" onClick={onClose}>
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}
