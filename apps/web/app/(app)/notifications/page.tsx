"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "../../../components/Button";
import { Card, CardTitle } from "../../../components/Card";
import { useShell } from "../../../components/AppShell";
import { useToast } from "../../../components/Toast";
import { EmptyState } from "../../../components/shared/EmptyState";
import { PageHeader } from "../../../components/shared/PageHeader";
import { apiRequest } from "../../../lib/api";
import type {
  NotificationDelivery,
  NotificationsListResponse,
} from "../../../lib/types";
import { useShop } from "../../../providers";
import { useReveal } from "../../../hooks/useReveal";

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function deliveryTitle(d: NotificationDelivery): string {
  const item = d.incident?.inventoryItem;
  if (item?.productTitle) {
    return item.variantTitle && item.variantTitle !== "Default Title"
      ? `${item.productTitle} · ${item.variantTitle}`
      : item.productTitle;
  }
  return d.incident?.type ?? "Notification";
}

function isUnread(d: NotificationDelivery): boolean {
  return d.channel === "IN_APP" && d.destination !== "read";
}

function statusChip(status?: string): string {
  const s = String(status ?? "").toUpperCase();
  if (s === "FAILED") return "chip hot";
  if (s === "SENT") return "chip on";
  if (s === "SUPPRESSED") return "chip";
  return "chip";
}

export default function NotificationsPage() {
  const { shop } = useShop();
  const { ready, setBadges } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [channelFilter, setChannelFilter] = useState<"ALL" | "IN_APP" | "EMAIL">(
    "ALL",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        channelFilter === "ALL" ? "" : `?channel=${channelFilter}`;
      const res = await apiRequest<NotificationsListResponse>(
        `/api/v1/notifications${params}`,
        { shop },
      );
      const list = res?.items ?? [];
      setItems(list);
      setBadges({
        notifications: list.filter(isUnread).length,
      });
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [shop, setBadges, channelFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(ready && !loading, null, [items, ready, loading]);

  const markRead = async (ids?: string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest("/api/v1/notifications/read", {
        method: "POST",
        shop,
        body: JSON.stringify(ids?.length ? { ids } : {}),
      });
      showToast(ids?.length ? "Marked as read" : "All marked as read");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = items.filter(isUnread).length;

  return (
    <div className="pg">
      <PageHeader
        title="Notifications"
        subtitle="In-app and email delivery history with status."
        actions={
          unreadCount ? (
            <Button disabled={busy} onClick={() => void markRead()}>
              Mark all read
            </Button>
          ) : null
        }
      />

      <Card loading={loading}>
        <CardTitle
          title="Deliveries"
          subtitle={
            items.length
              ? `${items.length} recent · ${unreadCount} unread in-app`
              : "No deliveries yet"
          }
          action={
            <select
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(e.target.value as "ALL" | "IN_APP" | "EMAIL")
              }
              aria-label="Filter channel"
            >
              <option value="ALL">All channels</option>
              <option value="IN_APP">In-app</option>
              <option value="EMAIL">Email</option>
            </select>
          }
        />
        {!items.length ? (
          <EmptyState
            icon="no"
            title="No notifications"
            description="In-app and email alerts appear here when detection opens incidents and preferences allow delivery."
          />
        ) : (
          items.map((d) => (
            <div className="list-row" key={d.id}>
              <div>
                <b>
                  {d.incident?.id ? (
                    <Link
                      href={`/incidents/${encodeURIComponent(d.incident.id)}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {deliveryTitle(d)}
                    </Link>
                  ) : (
                    deliveryTitle(d)
                  )}
                  {isUnread(d) ? (
                    <span className="chip" style={{ marginLeft: 8 }}>
                      Unread
                    </span>
                  ) : null}
                </b>
                <div className="m">
                  <span className="ch">{d.channel ?? "IN_APP"}</span>
                  {" · "}
                  <span className={statusChip(d.status)}>{d.status ?? "—"}</span>
                  {" · "}
                  {d.incident?.severity ?? "—"}
                  {d.destination && d.channel === "EMAIL"
                    ? ` · ${d.destination}`
                    : ""}
                  {d.errorCode ? ` · ${d.errorCode}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono m">
                  {formatWhen(d.sentAt ?? d.createdAt)}
                </div>
                {isUnread(d) ? (
                  <Button
                    style={{ marginTop: 6 }}
                    disabled={busy}
                    onClick={() => void markRead([d.id])}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
