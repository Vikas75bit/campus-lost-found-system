"use client";

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { NotificationItem } from "@/lib/types";

export default function StudentNotificationsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<NotificationItem[]>("/api/notifications")
      .then(setItems)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load notifications", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      showToast("Failed to mark notification as read", "error");
    }
  };

  return (
    <AppShell title="Notifications" subtitle="Alerts for candidate matches, claim updates, and handovers.">
      {loading ? (
        <LoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" description="You are all caught up." />
      ) : (
        <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-[#111412]">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-4 ${n.is_read ? "" : "bg-secondary/5"}`}
            >
              <div>
                <p className="text-sm font-medium text-zinc-100">{n.title}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{n.message}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-[#111412] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800/60 shrink-0"
                >
                  <Check className="h-3 w-3" /> Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

