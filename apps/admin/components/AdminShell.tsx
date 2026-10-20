"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { clearAdminToken } from "../lib/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/shops", label: "Shops" },
  { href: "/plans", label: "Plans" },
  { href: "/ai", label: "AI config" },
  { href: "/settings", label: "Settings" },
];

function isOn(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearAdminToken();
    router.replace("/login");
  };

  return (
    <div className="shell">
      <aside className="aside">
        <div className="br">
          <BrandMark />
          <div>
            <b>Bundle Safety</b>
            <small>Platform admin</small>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`ni${isOn(pathname, item.href) ? " on" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ft">
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin">{children}</main>
    </div>
  );
}
