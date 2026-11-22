"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, ArrowRight, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { Claim, LostItem, MatchCandidate } from "@/lib/types";

export default function StudentDashboardPage() {
  const [reports, setReports] = useState<LostItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<LostItem[]>("/api/lost-items"),
      apiFetch<Claim[]>("/api/claims"),
      apiFetch<MatchCandidate[]>("/api/matching/candidates"),
    ])
      .then(([r, c, m]) => {
        setReports(r);
        setClaims(c);
        setMatches(m);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const openReports = reports.filter((r) => r.status === "open" || r.status === "matched").length;
  const activeClaims = claims.filter((c) => ["submitted", "under_review", "info_requested", "approved"].includes(c.status)).length;

  return (
    <AppShell
      title="Student Dashboard"
      subtitle="Track your lost-item reports, potential matches, and ownership claims."
      action={
        <Link
          href="/student/report-lost"
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          Report Lost Item
        </Link>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState rows={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">My Lost Reports</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{reports.length}</p>
              <p className="mt-1 text-xs text-zinc-400">{openReports} currently open</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Suggested Matches</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{matches.length}</p>
              <p className="mt-1 text-xs text-zinc-400">Candidate pairs for staff review</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-[#111412] p-4">
              <p className="text-xs font-medium text-zinc-400">Ownership Claims</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{claims.length}</p>
              <p className="mt-1 text-xs text-zinc-400">{activeClaims} active or approved</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Lost Reports */}
            <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-100">Recent Lost Reports</h2>
                <Link
                  href="/student/my-reports"
                  className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary-light"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {reports.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No lost reports yet"
                    description="Submit a lost-item report so staff and matching can check incoming custody items."
                  />
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/70">
                  {reports.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">{r.item_description}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {r.category_name || "Item"} · {r.approximate_location} · {formatDateTime(r.lost_date_time)}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Permitted Suggested Matches */}
            <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-100">Potential Candidate Matches</h2>
                <Link
                  href="/student/browse-found"
                  className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:text-secondary-light"
                >
                  Browse custody items <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="border-b border-zinc-800/70 bg-[#090B0A] px-4 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
                <Info className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                Similarity scores indicate retrieval relevance only; staff verify ownership before handover.
              </div>
              {matches.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No candidate matches yet"
                    description="When a found item resembles one of your reports, it will appear here."
                  />
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/70">
                  {matches.slice(0, 5).map((m) => (
                    <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          Found #{m.found_item_id}: {m.found_item_description}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Matches your report #{m.lost_item_id} · Similarity: {m.match_score.toFixed(1)}%
                        </p>
                      </div>
                      <StatusBadge status={m.staff_review_status} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

