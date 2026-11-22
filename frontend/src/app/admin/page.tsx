"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ShieldCheck, ScrollText, BarChart3 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch } from "@/lib/api";
import type { DashboardOverview } from "@/lib/types";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardOverview>("/api/admin/dashboard-stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Administrator Overview"
      subtitle="System-wide governance, role assignments, audit history, and matching evaluation."
    >
      {loading || !stats ? (
        <LoadingState rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Total Lost Reports</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.total_lost_items}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.open_lost_items} open · {stats.resolved_lost_items} resolved
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Custody Inventory</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.total_found_items}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.items_in_custody} in custody · {stats.items_returned} returned
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Claims &amp; Handovers</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.total_claims}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.pending_claims} pending · {stats.completed_handovers} handovers
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Match Candidates</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.total_match_candidates}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {stats.high_confidence_matches} high similarity (&ge; 80%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/admin/users"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <Users className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">User Accounts</h2>
              <p className="mt-1 text-xs text-zinc-400">Inspect active/inactive status of campus accounts.</p>
            </Link>
            <Link
              href="/admin/roles"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <ShieldCheck className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Staff &amp; Roles</h2>
              <p className="mt-1 text-xs text-zinc-400">Assign student, staff, and admin permissions.</p>
            </Link>
            <Link
              href="/admin/audit-logs"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <ScrollText className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Audit Logs</h2>
              <p className="mt-1 text-xs text-zinc-400">Review immutable database mutation records.</p>
            </Link>
            <Link
              href="/admin/analytics"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <BarChart3 className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Matching Analytics</h2>
              <p className="mt-1 text-xs text-zinc-400">Run live Baseline vs Semantic vs Hybrid benchmark.</p>
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}

