"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AuditLog[]>("/api/admin/audit-logs")
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Audit Logs" subtitle="Immutable database audit trail for sensitive mutations.">
      {loading ? (
        <LoadingState rows={5} />
      ) : logs.length === 0 ? (
        <EmptyState title="No audit logs" description="Database audit entries appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Table &amp; Record</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Changes</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs text-zinc-400">#{l.id}</td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-100 whitespace-nowrap">
                    {l.table_name} #{l.record_id}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-secondary">{l.action}</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-400 max-w-md truncate">
                    {l.old_values ? `${l.old_values} -> ` : ""}
                    {l.new_values || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(l.created_at)}
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

