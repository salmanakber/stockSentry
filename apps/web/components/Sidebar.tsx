"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "./IconSprite";

export interface SidebarBadges {
  incidents?: number;
  notifications?: number;
}

export interface SidebarMeta {
  monitoringLabel?: string;
  monitoringSub?: string;
  planName?: string;
  planUsage?: string;
  planPct?: number;
  userInitials?: string;
  userName?: string;
  userRole?: string;
}

const NAV: {
  group: string;
  items: {
    icon: string;
    label: string;
    href: string;
    badgeKey?: keyof SidebarBadges;
    quiet?: boolean;
  }[];
}[] = [
  {
    group: "Monitor",
    items: [
      { icon: "ov", label: "Overview", href: "/overview" },
      {
        icon: "in",
        label: "Incidents",
        href: "/incidents",
        badgeKey: "incidents",
      },
      { icon: "hi", label: "Inventory History", href: "/history" },
    ],
  },
  {
    group: "Catalog",
    items: [
      { icon: "pr", label: "Products & Locations", href: "/products" },
      { icon: "bu", label: "Bundle Groups", href: "/bundles" },
      { icon: "db", label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    group: "Workspace",
    items: [
      { icon: "ex", label: "Reports / Exports", href: "/exports" },
      {
        icon: "no",
        label: "Notifications",
        href: "/notifications",
        badgeKey: "notifications",
        quiet: true,
      },
      { icon: "se", label: "Settings", href: "/settings" },
      { icon: "db", label: "Billing", href: "/billing" },
      { icon: "he", label: "Help", href: "/help" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/overview") {
    return pathname === "/overview" || pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function mob() {
  return typeof window !== "undefined" && window.innerWidth <= 900;
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: (next?: boolean) => void;
  onCloseMobile: () => void;
  badges?: SidebarBadges;
  meta?: SidebarMeta;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onCloseMobile,
  badges = {},
  meta = {},
}: SidebarProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const actRef = useRef<HTMLSpanElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);

  const place = useCallback((el: HTMLElement | null, anchor: HTMLElement) => {
    if (!el) return;
    el.style.transform = `translateY(${anchor.offsetTop}px)`;
    el.style.height = `${anchor.offsetHeight}px`;
  }, []);

  const syncActive = useCallback(() => {
    const nav = navRef.current;
    const act = actRef.current;
    if (!nav || !act) return;
    const on = nav.querySelector<HTMLElement>(".ni.on");
    if (on) place(act, on);
  }, [place]);

  useLayoutEffect(() => {
    syncActive();
  }, [pathname, collapsed, syncActive]);

  useEffect(() => {
    const onResize = () => {
      syncActive();
      if (mob()) document.body.classList.remove("col");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncActive]);

  let animIndex = 0;

  const planPct = meta.planPct ?? 0;
  const monitoringLabel = meta.monitoringLabel ?? "Monitoring";
  const monitoringSub = meta.monitoringSub ?? "Awaiting first inventory verification";
  const planName = meta.planName ?? "Plan";
  const planUsage = meta.planUsage ?? "—";
  const userInitials = meta.userInitials ?? "?";
  const userName = meta.userName ?? "Shop";
  const userRole = meta.userRole ?? "read-only access";

  return (
    <aside className="side" id="side">
      <button
        className="eh"
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => onToggleCollapse()}
      >
        <Icon id="cl" />
      </button>
      <div className="br">
        <div className="mk">
          <svg viewBox="0 0 24 24">
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="lb">
          <b>StockSentry</b>
          <small>Inventory monitoring</small>
        </div>
      </div>
      <nav
        className="nav"
        id="nav"
        ref={navRef}
        onMouseLeave={() => {
          if (hlRef.current) hlRef.current.style.opacity = "0";
        }}
      >
        <span className="act" id="act" ref={actRef} />
        <span className="hl" id="hl" ref={hlRef} />
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="sl">
              <span className="lb">{group.group}</span>
            </div>
            {group.items.map((item) => {
              const k = animIndex++;
              const active = isActive(pathname, item.href);
              const badge =
                item.badgeKey != null ? badges[item.badgeKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ni${active ? " on" : ""}`}
                  data-t={item.label}
                  style={{ animationDelay: `${k * 55 + 200}ms` }}
                  onMouseEnter={(e) => {
                    place(hlRef.current, e.currentTarget);
                    if (hlRef.current) hlRef.current.style.opacity = "1";
                  }}
                  onClick={() => {
                    if (mob()) onCloseMobile();
                  }}
                >
                  <Icon id={item.icon} />
                  <span className="lb" style={{ ["--i" as string]: k }}>
                    {item.label}
                  </span>
                  {badge != null && badge > 0 ? (
                    <b className={`bd${item.quiet ? " q" : ""}`}>{badge}</b>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="ft">
        <div className="mon">
          <span className="pls" />
          <div className="lb">
            <b>{monitoringLabel}</b>
            <small>{monitoringSub}</small>
          </div>
        </div>
        <div className="plan">
          <div>
            <span>{planName}</span>
            <b>{planUsage}</b>
          </div>
          <span className={`bar${planPct > 0 ? " in" : ""}`}>
            <i style={{ ["--w" as string]: `${planPct}%` }} />
          </span>
        </div>
        <div className="usr">
          <div className="av">{userInitials}</div>
          <div className="lb">
            <b>{userName}</b>
            <small>{userRole}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
