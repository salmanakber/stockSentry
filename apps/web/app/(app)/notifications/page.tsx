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
  return d.destination !== "read";
}

export default function NotificationsPage() {
  const { shop } = useShop();
  const { ready, setBadges } = useShell();
  const { showToast } = useToast();
  const [items, setItems] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<NotificationsListResponse>(
        "/api/v1/notifications",
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
  }, [shop, setBadges]);

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
        subtitle="In-app delivery history for incident alerts."
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
              ? `${items.length} recent · ${unreadCount} unread`
              : "No deliveries yet"
          }
        />
        {!items.length ? (
          <EmptyState
            icon="no"
            title="No notifications"
            description="In-app alerts appear here when detection rules open incidents and notification preferences allow delivery."
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
                  {d.channel ?? "IN_APP"} · {d.status ?? "—"} ·{" "}
                  {d.incident?.severity ?? "—"}
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
