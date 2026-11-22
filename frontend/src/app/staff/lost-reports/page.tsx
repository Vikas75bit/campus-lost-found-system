"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { LostItem } from "@/lib/types";

export default function StaffLostReportsPage() {
  const [reports, setReports] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<LostItem[]>(`/api/lost-items?${params.toString()}`);
      setReports(data);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell title="All Lost Reports" subtitle="Campus-wide student lost-item reports for staff lookup.">
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-[#111412] p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lost reports..."
            className="w-full rounded-md border border-zinc-700 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-700 bg-[#111412] px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="matched">Matched</option>
          <option value="claim_pending">Claim Pending</option>
          <option value="resolved">Resolved</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : reports.length === 0 ? (
        <EmptyState title="No lost reports" description="No reports match your filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Item Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Last-Known Location</th>
                <th className="px-4 py-3">Date Lost</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3 text-xs text-zinc-400">#{r.id}</td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-200 whitespace-nowrap">
                    {r.user_name || `User #${r.user_id}`}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{r.item_description}</p>
                    {r.distinctive_details && (
                      <p className="mt-0.5 text-xs text-zinc-400">Details: {r.distinctive_details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{r.category_name}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{r.approximate_location}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(r.lost_date_time)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={r.status} />
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

