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
          <img src="/images/logo-icon.png" alt="" />
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
