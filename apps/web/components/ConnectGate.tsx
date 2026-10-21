"use client";

import { Button } from "./Button";

interface ConnectGateProps {
  message: string;
  onConnect?: () => void;
  showConnect?: boolean;
}

export function ConnectGate({
  message,
  onConnect,
  showConnect = true,
}: ConnectGateProps) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="mk">
          <svg viewBox="0 0 24 24">
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h1>StockSentry</h1>
        <p>{message}</p>
        {showConnect && onConnect ? (
          <Button variant="primary" onClick={onConnect}>
            Connect Shopify
          </Button>
        ) : null}
      </div>
    </div>
  );
}
