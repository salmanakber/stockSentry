"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { BootLoader } from "./BootLoader";
import { GlobalSearch } from "./GlobalSearch";
import { IconSprite } from "./IconSprite";
import { Sidebar, type SidebarBadges, type SidebarMeta } from "./Sidebar";
import { ToastProvider } from "./Toast";
import { TopBar } from "./TopBar";
import {
  UpgradeFeatureModal,
  type UpgradeFeatureInfo,
} from "./UpgradeFeatureModal";
import { useReveal } from "../hooks/useReveal";
import { apiRequest } from "../lib/api";
import type { BillingStatusResponse } from "../lib/types";
import { useShop } from "../providers";

function buildLockedFeatures(
  entitlements: BillingStatusResponse["entitlements"] | undefined,
): Record<string, UpgradeFeatureInfo> {
  const locked: Record<string, UpgradeFeatureInfo> = {};
  if (!entitlements) return locked;

  if (entitlements.exportsEnabled === false) {
    locked["/exports"] = {
      href: "/exports",
      label: "Reports / Exports",
      title: "Exports are on a paid plan",
      body: "CSV reports and scheduled exports help you share inventory risk with your team. Upgrade to Starter or Pro to generate and download them.",
      requiredPlan: "Starter",
    };
  }

  if (entitlements.supplierAutomation === false) {
    locked["/replenishment"] = {
      href: "/replenishment",
      label: "Replenishment",
      title: "Supplier automation needs Pro",
      body: "Draft purchase orders, email suppliers, and track replenishment from low-stock signals. This workflow unlocks on the Pro plan.",
      requiredPlan: "Pro",
    };
  }

  return locked;
}

interface ShellContextValue {
  setBadges: (b: SidebarBadges) => void;
  setMeta: (m: SidebarMeta) => void;
  setCardLoading: (loading: boolean) => void;
  cardLoading: boolean;
  ready: boolean;
}

const ShellContext = createContext<ShellContextValue>({
  setBadges: () => undefined,
  setMeta: () => undefined,
  setCardLoading: () => undefined,
  cardLoading: false,
  ready: false,
});

export function useShell() {
  return useContext(ShellContext);
}

function mob() {
  return typeof window !== "undefined" && window.innerWidth <= 900;
}

interface AppShellProps {
  children: ReactNode;
  demo?: boolean;
}

export function AppShell({ children, demo = false }: AppShellProps) {
  const pathname = usePathname();
  const { shop, authenticated } = useShop();
  const [booted, setBooted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadgesState] = useState<SidebarBadges>({});
  const [meta, setMetaState] = useState<SidebarMeta>({});
  const [cardLoading, setCardLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState<
    Record<string, UpgradeFeatureInfo>
  >({});
  const [upgradePrompt, setUpgradePrompt] =
    useState<UpgradeFeatureInfo | null>(null);

  const setBadges = useCallback((b: SidebarBadges) => {
    setBadgesState((prev) => ({ ...prev, ...b }));
  }, []);

  const setMeta = useCallback((m: SidebarMeta) => {
    setMetaState((prev) => ({ ...prev, ...m }));
  }, []);

  // Restore collapse before paint to avoid sidebar animation flash
  useEffect(() => {
    try {
      if (!mob() && localStorage.getItem("bs-col") === "1") {
        document.body.classList.add("col");
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("col", collapsed && !mob());
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle("mo", mobileOpen);
  }, [mobileOpen]);

  useEffect(() => {
    if (booted) document.body.classList.add("ready");
    else document.body.classList.remove("ready");
    return () => document.body.classList.remove("ready");
  }, [booted]);

  const toggleCollapse = useCallback((next?: boolean) => {
    if (mob()) return;
    setCollapsed((prev) => {
      const f = next === undefined ? !prev : next;
      try {
        localStorage.setItem("bs-col", f ? "1" : "0");
      } catch {
        /* ignore */
      }
      return f;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      const typing = /input|textarea|select/i.test(tag);
      if (
        e.key === "[" &&
        !mob() &&
        !typing
      ) {
        toggleCollapse();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapse]);

  const refreshNotificationBadge = useCallback(async () => {
    if (demo || !authenticated || !booted) return;
    try {
      const res = await apiRequest<{ items?: Array<{ id: string }> }>(
        "/api/v1/notifications?unread=1&limit=50",
        { shop },
      );
      setBadges({ notifications: res.items?.length ?? 0 });
    } catch {
      /* keep prior badge */
    }
  }, [authenticated, booted, demo, setBadges, shop]);

  useEffect(() => {
    if (!booted || demo || !authenticated) return;
    void refreshNotificationBadge();
    const interval = window.setInterval(() => {
      void refreshNotificationBadge();
    }, 60_000);
    const onFocus = () => void refreshNotificationBadge();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [authenticated, booted, demo, refreshNotificationBadge]);

  useEffect(() => {
    if (!booted || demo || !authenticated) return;
    void (async () => {
      try {
        const bill = await apiRequest<BillingStatusResponse>(
          "/api/v1/billing/status",
          { shop },
        ).catch(() =>
          apiRequest<BillingStatusResponse>("/api/v1/billing", { shop }),
        );
        const free =
          bill.planSlug === "free" ||
          (bill.entitlements?.priceUsdMonthly ?? 1) <= 0;
        setMeta({ showUpgradeCta: free });
        setLockedFeatures(buildLockedFeatures(bill.entitlements));
      } catch {
        /* ignore */
      }
    })();
  }, [authenticated, booted, demo, setMeta, shop]);

  useReveal(booted, null, [booted, pathname, cardLoading]);

  const shellValue = useMemo(
    () => ({
      setBadges,
      setMeta,
      setCardLoading,
      cardLoading,
      ready: booted,
    }),
    [cardLoading, booted, setBadges, setMeta],
  );

  return (
    <ToastProvider>
      <ShellContext.Provider value={shellValue}>
        <IconSprite />
        {!booted ? (
          <BootLoader onDone={() => setBooted(true)} />
        ) : null}
        <div
          className="scrim"
          id="scrim"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onCloseMobile={() => setMobileOpen(false)}
          badges={badges}
          meta={meta}
          lockedFeatures={lockedFeatures}
          onLockedNav={setUpgradePrompt}
        />
        <main>
          <TopBar
            demo={demo}
            hasNotifications={(badges.notifications ?? 0) > 0}
            onOpenMobile={() => setMobileOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
          />
          {children}
        </main>
        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          demo={demo}
        />
        <UpgradeFeatureModal
          feature={upgradePrompt}
          onClose={() => setUpgradePrompt(null)}
        />
      </ShellContext.Provider>
    </ToastProvider>
  );
}
