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
import { useReveal } from "../hooks/useReveal";
import { apiRequest } from "../lib/api";
import { useShop } from "../providers";

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
        const bill = await apiRequest<{
          planSlug?: string;
          entitlements?: { isFree?: boolean; priceUsdMonthly?: number };
        }>("/api/v1/billing/status", { shop }).catch(() =>
          apiRequest<{
            planSlug?: string;
            entitlements?: { isFree?: boolean; priceUsdMonthly?: number };
          }>("/api/v1/billing", { shop }),
        );
        const free =
          bill.planSlug === "free" ||
          bill.entitlements?.isFree === true ||
          (bill.entitlements?.priceUsdMonthly ?? 1) <= 0;
        setMeta({ showUpgradeCta: free });
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
      </ShellContext.Provider>
    </ToastProvider>
  );
}
