"use client";

import { useState, type FormEvent } from "react";
import { BrandMark } from "../../components/BrandMark";
import { adminRequest } from "../../lib/api";
import { setAdminToken } from "../../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persist, setPersist] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminRequest<{ token: string }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAdminToken(res.token, persist);
      window.location.assign("/admin/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={(e) => void onSubmit(e)}>
        <BrandMark />
        <h1>Admin sign in</h1>
        <p>Sign in to the StockSentry admin console.</p>
        {error ? <p className="err">{error}</p> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <label className="field-check">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
          />
          <span>Remember on this device</span>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn p" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
