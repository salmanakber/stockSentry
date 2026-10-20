"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../lib/api";

const LABELS: Record<string, string> = {
  groq: "Groq",
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Anthropic Claude",
};

type ProviderEntry = {
  hasKey?: boolean;
  apiKeyMasked?: string | null;
  model?: string | null;
  enabled?: boolean;
};

type AiApiResponse = {
  providers: {
    order: string[];
    groq?: ProviderEntry;
    gemini?: ProviderEntry;
    openai?: ProviderEntry;
    claude?: ProviderEntry;
  };
};

type Row = {
  id: string;
  enabled: boolean;
  model: string;
  apiKeySet: boolean;
};

export default function AiConfigPage() {
  const [order, setOrder] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const apply = (res: AiApiResponse) => {
    const p = res.providers;
    const ord = p.order?.length
      ? p.order
      : ["groq", "gemini", "openai", "claude"];
    setOrder(ord);
    const next: Record<string, Row> = {};
    for (const id of ord) {
      const entry = p[id as keyof typeof p] as ProviderEntry | undefined;
      next[id] = {
        id,
        enabled: entry?.enabled !== false,
        model: entry?.model ?? "",
        apiKeySet: Boolean(entry?.hasKey),
      };
    }
    setRows(next);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminRequest<AiApiResponse>("/api/admin/config/ai");
      apply(res);
      setKeys({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI config");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const i = next.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const providers: Record<string, unknown> = { order };
      for (const id of order) {
        const row = rows[id];
        if (!row) continue;
        providers[id] = {
          enabled: row.enabled,
          model: row.model,
          apiKey: keys[id] || undefined,
        };
      }
      const res = await adminRequest<AiApiResponse>("/api/admin/config/ai", {
        method: "PATCH",
        body: JSON.stringify({ providers }),
      });
      apply(res);
      setKeys({});
      setMsg("AI configuration saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (providerId: string) => {
    setTesting(providerId);
    setMsg(null);
    setError(null);
    try {
      const res = await adminRequest<{ ok: boolean; message?: string }>(
        "/api/admin/config/ai/test",
        {
          method: "POST",
          body: JSON.stringify({
            providerId,
            apiKey: keys[providerId] || undefined,
          }),
        },
      );
      setMsg(res.message ?? (res.ok ? "Connection OK" : "Connection failed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>AI configuration</h1>
          <div className="sub">
            Provider order, API keys, models, and connection tests
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => void load()}>
            Refresh
          </button>
          <button
            type="button"
            className="btn p"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      {!order.length ? (
        <p className="muted">Loading…</p>
      ) : (
        order.map((id, index) => {
          const row = rows[id];
          if (!row) return null;
          return (
            <div className="card" key={id}>
              <div className="ct">
                <div>
                  <h2>
                    {LABELS[id] ?? id}{" "}
                    <span className="mono" style={{ color: "var(--mut)" }}>
                      #{index + 1}
                    </span>
                  </h2>
                  <p>
                    Key {row.apiKeySet ? "configured" : "not set"}
                    {keys[id] ? " · new value pending save" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={index === order.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    Down
                  </button>
                </div>
              </div>

              <label className="field-check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) =>
                    setRows((r) => ({
                      ...r,
                      [id]: { ...row, enabled: e.target.checked },
                    }))
                  }
                />
                <span>Enabled</span>
              </label>

              <div className="field-row">
                <div className="field">
                  <label>API key</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      row.apiKeySet ? "•••••••• (unchanged)" : "Paste key"
                    }
                    value={keys[id] ?? ""}
                    onChange={(e) =>
                      setKeys((k) => ({ ...k, [id]: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Model</label>
                  <input
                    value={row.model}
                    onChange={(e) =>
                      setRows((r) => ({
                        ...r,
                        [id]: { ...row, model: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={testing === id}
                  onClick={() => void testConnection(id)}
                >
                  {testing === id ? "Testing…" : "Test connection"}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
