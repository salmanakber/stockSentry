"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../lib/api";
import type { AdminSettingsInfo } from "../../lib/types";

export default function SettingsPage() {
  const [info, setInfo] = useState<AdminSettingsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminRequest<AdminSettingsInfo>("/api/admin/settings");
      setInfo(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Bootstrap notes and admin JWT details</div>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}

      <div className="card">
        <div className="ct">
          <div>
            <h2>Bootstrap</h2>
            <p>First-time platform admin setup</p>
          </div>
        </div>
        <p className="note" style={{ marginTop: 0 }}>
          {info?.bootstrapNote ??
            "Set ADMIN_PASSWORD and ADMIN_JWT_SECRET in the monorepo root .env, then sign in at /admin/login. The JWT is stored in the browser and sent as x-stocksentry-admin-token."}
        </p>
        <div className="field-row" style={{ marginTop: 16 }}>
          <div>
            <small className="muted">Bootstrap secret</small>
            <div>
              <span
                className={`chip ${info?.bootstrapSecretConfigured ? "on" : "off"}`}
              >
                {info?.bootstrapSecretConfigured ? "Configured" : "Missing"}
              </span>
            </div>
          </div>
          <div>
            <small className="muted">JWT secret</small>
            <div>
              <span className={`chip ${info?.jwt.configured ? "on" : "off"}`}>
                {info?.jwt.configured ? "Configured" : "Missing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          <div>
            <h2>JWT</h2>
            <p>How the admin UI authenticates API calls</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <td>Header</td>
                <td className="mono">
                  {info?.jwt.headerName ?? "x-stocksentry-admin-token"}
                </td>
              </tr>
              <tr>
                <td>Algorithm</td>
                <td className="mono">{info?.jwt.algorithm ?? "HS256"}</td>
              </tr>
              <tr>
                <td>TTL</td>
                <td className="mono">
                  {info?.jwt.ttlHours != null
                    ? `${info.jwt.ttlHours} hours`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
