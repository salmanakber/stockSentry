"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "../../lib/api";

type EmailConfigResponse = {
  apiKeyMasked?: string | null;
  hasKey?: boolean;
  last4?: string | null;
  fromEmail?: string | null;
  enabled?: boolean;
  resolvedHasKey?: boolean;
  resolvedFromEmail?: string | null;
  resolvedEnabled?: boolean;
  envFallback?: {
    hasResendKey?: boolean;
    emailFrom?: string | null;
  };
};

export default function EmailResendPage() {
  const [enabled, setEnabled] = useState(true);
  const [fromEmail, setFromEmail] = useState(
    "StockSentry <noreply@stocksentry.tidyflowapp.com>",
  );
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [envHint, setEnvHint] = useState("");

  const apply = (res: EmailConfigResponse) => {
    setEnabled(res.enabled !== false);
    setFromEmail(
      res.fromEmail ||
        res.resolvedFromEmail ||
        "StockSentry <noreply@stocksentry.tidyflowapp.com>",
    );
    setHasKey(Boolean(res.hasKey || res.resolvedHasKey));
    setMasked(res.apiKeyMasked ?? null);
    const parts: string[] = [];
    if (res.envFallback?.hasResendKey) parts.push("env RESEND_API_KEY present");
    if (res.envFallback?.emailFrom)
      parts.push(`env EMAIL_FROM=${res.envFallback.emailFrom}`);
    setEnvHint(parts.join(" · "));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminRequest<EmailConfigResponse>(
        "/api/admin/config/email",
      );
      apply(res);
      setApiKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load email config");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await adminRequest<EmailConfigResponse>(
        "/api/admin/config/email",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
            fromEmail,
            apiKey: apiKey || undefined,
          }),
        },
      );
      apply(res);
      setApiKey("");
      setMsg("Resend settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (testing) return;
    setTesting(true);
    setMsg(null);
    setError(null);
    try {
      const res = await adminRequest<{ ok: boolean; message?: string }>(
        "/api/admin/config/email/test",
        {
          method: "POST",
          body: JSON.stringify({ to: testTo }),
        },
      );
      setMsg(res.message ?? (res.ok ? "Test email sent" : "Test failed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="pg">
      <div className="head">
        <div>
          <h1>Email / Resend</h1>
          <div className="sub">
            Used for merchant incident and refill alert emails.
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

      <div className="card">
        <div className="ct">
          <div>
            <h2>Resend provider</h2>
            <p>
              AppConfig key <span className="mono">email.resend</span>
              {envHint ? ` · ${envHint}` : ""}
            </p>
          </div>
        </div>

        <label className="field-check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enabled</span>
        </label>

        <div className="field-row">
          <div className="field">
            <label htmlFor="from-email">From email</label>
            <input
              id="from-email"
              type="text"
              placeholder='StockSentry &lt;noreply@domain.com&gt;'
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="api-key">API key</label>
            <input
              id="api-key"
              type="password"
              autoComplete="new-password"
              placeholder={
                hasKey
                  ? `••••••••${masked ? ` (${masked})` : ""} — leave blank to keep`
                  : "Paste Resend API key"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Key {hasKey ? "configured" : "not set"}
              {apiKey ? " · new value pending save" : ""}
              {masked ? ` · masked ${masked}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          <div>
            <h2>Send test email</h2>
            <p>Uses the saved (or env-fallback) Resend configuration.</p>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="test-to">To address</label>
            <input
              id="test-to"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            disabled={testing || !testTo.includes("@")}
            onClick={() => void sendTest()}
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
      </div>
    </div>
  );
}
