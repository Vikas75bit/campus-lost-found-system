"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { Claim } from "@/lib/types";

export default function MyClaimsPage() {
  const { showToast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Claim[]>("/api/claims")
      .then(setClaims)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load claims", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  return (
    <AppShell
      title="My Ownership Claims"
      subtitle="Track verification decisions. Approved claims require in-person ID verification and physical handover before case resolution."
    >
      {loading ? (
        <LoadingState rows={4} />
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claims submitted"
          description="Browse found items in university custody to submit an ownership claim."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Claim ID</th>
                <th className="px-4 py-3">Found Item</th>
                <th className="px-4 py-3">Submitted Evidence</th>
                <th className="px-4 py-3">Staff Decision Notes</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3 text-xs text-zinc-400">#{c.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">
                      Found #{c.found_item_id}: {c.found_item_description || "Item"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">{c.claim_description}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{c.proof_evidence_notes}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {c.staff_decision_notes || (
                      <span className="text-zinc-500">Awaiting staff review</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(c.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={c.status} />
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

