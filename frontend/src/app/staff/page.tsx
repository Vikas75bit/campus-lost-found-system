"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PackageCheck, Sparkles, ClipboardCheck, HandHeart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch } from "@/lib/api";
import type { DashboardOverview } from "@/lib/types";

export default function StaffOverviewPage() {
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
      title="Staff Operations Overview"
      subtitle="Physical custody intake, candidate match review, claim verification, and handover desk."
      action={
        <Link
          href="/staff/found-items"
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          Record Found Item
        </Link>
      }
    >
      {loading || !stats ? (
        <LoadingState rows={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Items in Custody</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.items_in_custody}</p>
              <p className="mt-1 text-xs text-zinc-400">Of {stats.total_found_items} total found</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Pending Claims</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.pending_claims}</p>
              <p className="mt-1 text-xs text-zinc-400">Awaiting staff assessment</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Awaiting Handover</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.items_awaiting_handover}</p>
              <p className="mt-1 text-xs text-zinc-400">Approved, not yet collected</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Completed Handovers</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{stats.completed_handovers}</p>
              <p className="mt-1 text-xs text-zinc-400">Cases formally resolved</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/staff/found-items"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <PackageCheck className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Found Items Custody</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Log physically received items and assign storage bin locations.
              </p>
            </Link>
            <Link
              href="/staff/matches"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <Sparkles className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Match Review</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Inspect {stats.total_match_candidates} pgvector + hybrid candidate pairs.
              </p>
            </Link>
            <Link
              href="/staff/claims"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <ClipboardCheck className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Claims Assessment</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Review ownership proof, request info, approve or reject claims.
              </p>
            </Link>
            <Link
              href="/staff/handovers"
              className="rounded-lg border border-zinc-800 bg-[#111412] p-4 hover:border-secondary/40 transition-colors"
            >
              <HandHeart className="h-5 w-5 text-secondary" />
              <h2 className="mt-3 text-sm font-semibold text-zinc-100">Handover Desk</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Verify recipient photo ID and record physical item return.
              </p>
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  );
}

