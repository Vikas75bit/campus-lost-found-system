"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { StatusHistory } from "@/lib/types";

export default function StaffActivityHistoryPage() {
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<StatusHistory[]>("/api/admin/status-history")
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Activity & Status History"
      subtitle="Chronological status transition log across lost reports, found custody items, and claims."
    >
      {loading ? (
        <LoadingState rows={5} />
      ) : history.length === 0 ? (
        <EmptyState title="No status history" description="Status transitions appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Old Status</th>
                <th className="px-4 py-3">New Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-100 whitespace-nowrap">
                    {h.entity_type} #{h.entity_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {h.old_status ? <StatusBadge status={h.old_status} /> : <span className="text-xs text-zinc-500">Initial</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={h.new_status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{h.change_reason || "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(h.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

