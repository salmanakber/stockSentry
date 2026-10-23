"use client";

import Link from "next/link";
import { Icon } from "./IconSprite";

interface TopBarProps {
  demo?: boolean;
  hasNotifications?: boolean;
  onOpenMobile?: () => void;
  onOpenSearch?: () => void;
}

export function TopBar({
  demo = false,
  hasNotifications = false,
  onOpenMobile,
  onOpenSearch,
}: TopBarProps) {
  return (
    <div className="top">
      <button
        className="hb"
        type="button"
        aria-label="Open menu"
        onClick={onOpenMobile}
      >
        <Icon id="mn" />
      </button>
      <button
        type="button"
        className="sr"
        onClick={() => onOpenSearch?.()}
        aria-label="Search (⌘K)"
      >
        <Icon id="sc" />
        Search products, incidents, locations…
        <kbd>⌘K</kbd>
      </button>
      {demo ? <span className="tag">Sample data</span> : null}
      <Link
        href="/notifications"
        className="ib"
        aria-label="Notifications"
        style={{ textDecoration: "none" }}
      >
        <Icon id="no" />
        {hasNotifications ? <b /> : null}
      </Link>
    </div>
  );
}
