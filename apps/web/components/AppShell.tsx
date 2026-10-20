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
import { IconSprite } from "./IconSprite";
import { Sidebar, type SidebarBadges, type SidebarMeta } from "./Sidebar";
import { ToastProvider } from "./Toast";
import { TopBar } from "./TopBar";
import { useReveal } from "../hooks/useReveal";

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
  const [booted, setBooted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<SidebarBadges>({});
  const [meta, setMeta] = useState<SidebarMeta>({});
  const [cardLoading, setCardLoading] = useState(false);

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
      if (
        e.key === "[" &&
        !mob() &&
        !/input|textarea|select/i.test(
          (e.target as HTMLElement)?.tagName ?? "",
        )
      ) {
        toggleCollapse();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapse]);

  useReveal(booted, null, [booted, pathname, cardLoading]);

  const shellValue = useMemo(
    () => ({
      setBadges,
      setMeta,
      setCardLoading,
      cardLoading,
      ready: booted,
    }),
    [cardLoading, booted],
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
          />
          {children}
        </main>
      </ShellContext.Provider>
    </ToastProvider>
  );
}
