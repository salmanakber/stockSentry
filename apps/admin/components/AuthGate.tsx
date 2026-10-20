"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLoggedIn } from "../lib/auth";
import { AdminShell } from "./AdminShell";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === "/login";

  useEffect(() => {
    const ok = isLoggedIn();
    if (!ok && !isLogin) {
      router.replace("/login");
      return;
    }
    if (ok && isLogin) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [isLogin, pathname, router]);

  if (!ready) {
    return (
      <div className="gate">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (isLogin) return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
