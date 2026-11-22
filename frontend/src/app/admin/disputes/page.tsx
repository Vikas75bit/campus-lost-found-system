"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { Claim } from "@/lib/types";

export default function AdminDisputesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Claim[]>("/api/claims")
      .then((all) => {
        const countByFound: Record<number, number> = {};
        all.forEach((c) => {
          countByFound[c.found_item_id] = (countByFound[c.found_item_id] || 0) + 1;
        });
        setClaims(
          all.filter(
            (c) =>
              c.status === "info_requested" ||
              c.status === "rejected" ||
              (countByFound[c.found_item_id] || 0) > 1
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      title="Disputed & Exceptional Claims"
      subtitle="Claims with multiple competing claimants, rejected determinations, or requests for additional evidence."
    >
      {loading ? (
        <LoadingState rows={4} />
      ) : claims.length === 0 ? (
        <EmptyState
          title="No disputed claims"
          description="There are currently no contested, rejected, or info-requested claims."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Found Item</th>
                <th className="px-4 py-3">Claimant</th>
                <th className="px-4 py-3">Staff Decision Notes</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    #{c.id}
                    <div className="text-[11px] text-zinc-500">{formatDateTime(c.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-100">
                    #{c.found_item_id}: {c.found_item_description}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{c.claimant_name}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{c.staff_decision_notes || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

