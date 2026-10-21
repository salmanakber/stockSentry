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
          <div className="sub">Platform configuration status</div>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}

      <div className="card">
        <div className="ct">
          <div>
            <h2>Access</h2>
            <p>Admin console readiness</p>
          </div>
        </div>
        <div className="field-row" style={{ marginTop: 0 }}>
          <div>
            <small className="muted">Bootstrap</small>
            <div>
              <span
                className={`chip ${info?.bootstrapSecretConfigured ? "on" : "off"}`}
              >
                {info?.bootstrapSecretConfigured ? "Ready" : "Needs setup"}
              </span>
            </div>
          </div>
          <div>
            <small className="muted">Session auth</small>
            <div>
              <span className={`chip ${info?.jwt.configured ? "on" : "off"}`}>
                {info?.jwt.configured ? "Ready" : "Needs setup"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          <div>
            <h2>Session</h2>
            <p>How long signed-in admin sessions last</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <td>Session length</td>
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
