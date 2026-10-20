"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../lib/api";
import type { AdminStats } from "../lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminRequest<AdminStats>("/api/admin/stats");
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Platform health and shop footprint</div>
        </div>
        <button type="button" className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading && !stats ? <p className="muted">Loading stats…</p> : null}

      <div className="kp">
        <div className="card k">
          <div className="l">Shops total</div>
          <div className="v">{stats?.shops.total ?? "—"}</div>
        </div>
        <div className="card k">
          <div className="l">Installed</div>
          <div className="v">{stats?.shops.installed ?? "—"}</div>
        </div>
        <div className="card k">
          <div className="l">Open incidents</div>
          <div className="v">{stats?.incidents.open ?? "—"}</div>
        </div>
        <div className="card k">
          <div className="l">AI reports (month)</div>
          <div className="v">{stats?.ai.usedThisMonthAcrossShops ?? "—"}</div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          <div>
            <h2>Plan breakdown</h2>
            <p>Shops by plan slug</p>
          </div>
        </div>
        {!stats?.shops.byPlan?.length ? (
          <p className="muted">No plan data yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Shops</th>
                </tr>
              </thead>
              <tbody>
                {stats.shops.byPlan.map((row) => (
                  <tr key={row.planSlug}>
                    <td>
                      <span className="chip on">{row.planSlug}</span>
                    </td>
                    <td className="mono">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
