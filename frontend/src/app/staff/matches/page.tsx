"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Info, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { MatchCandidate, MatchSignal } from "@/lib/types";

export default function StaffMatchReviewPage() {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("");

  const [selected, setSelected] = useState<MatchCandidate | null>(null);
  const [decision, setDecision] = useState("relevant");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reviewFilter) params.set("review_status", reviewFilter);
      const data = await apiFetch<MatchCandidate[]>(`/api/matching/candidates?${params.toString()}`);
      setCandidates(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load candidates", "error");
    } finally {
      setLoading(false);
    }
  }, [reviewFilter, showToast]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleRefreshMatches = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch<{ message: string }>("/api/matching/refresh", { method: "POST" });
      showToast(res.message, "success");
      loadCandidates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to refresh matches", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const openReview = (m: MatchCandidate) => {
    setSelected(m);
    setDecision(m.staff_review_status === "unreviewed" ? "relevant" : m.staff_review_status);
    setNotes(m.staff_notes || "");
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/api/matching/${selected.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ staff_review_status: decision, staff_notes: notes.trim() || null }),
      });
      showToast("Match review recorded.", "success");
      setSelected(null);
      loadCandidates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save review", "error");
    } finally {
      setSaving(false);
    }
  };

  let parsedSignals: MatchSignal[] = [];
  let parsedDisclaimer =
    "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.";
  if (selected?.match_reasons) {
    try {
      const obj = JSON.parse(selected.match_reasons);
      if (Array.isArray(obj.signals)) parsedSignals = obj.signals;
      if (obj.disclaimer) parsedDisclaimer = obj.disclaimer;
    } catch {
      // ignore
    }
  }

  return (
    <AppShell
      title="Candidate Match Review"
      subtitle="Hybrid ranking powered by pgvector dense embeddings + structured metadata compatibility."
      action={
        <button
          type="button"
          onClick={handleRefreshMatches}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Run pgvector Match Discovery
        </button>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-[#111412] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Info className="h-4 w-4 text-zinc-500 shrink-0" />
          Similarity scores assist staff triage and never automatically approve claims or establish ownership.
        </div>
        <select
          value={reviewFilter}
          onChange={(e) => setReviewFilter(e.target.value)}
          className="rounded-md border border-zinc-700 bg-[#111412] px-3 py-1.5 text-xs"
        >
          <option value="">All Review States</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="relevant">Relevant</option>
          <option value="investigating">Investigating</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No candidate matches"
          description="Click Run pgvector Match Discovery to evaluate open lost reports against custody items."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Lost Report</th>
                <th className="px-4 py-3">Found Custody Item</th>
                <th className="px-4 py-3">Hybrid Score</th>
                <th className="px-4 py-3">Breakdown</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {candidates.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">
                      #{m.lost_item_id}: {m.lost_item_description}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {m.lost_owner_name} · {m.lost_location}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">
                      #{m.found_item_id}: {m.found_item_description}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {m.storage_location || "—"} · {m.found_location}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-secondary whitespace-nowrap">
                    {m.match_score.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    Vec {m.semantic_score.toFixed(0)}% · Str {m.structured_score.toFixed(0)}% · Kw{" "}
                    {m.keyword_score.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={m.staff_review_status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openReview(m)}
                      className="rounded-md border border-zinc-700 bg-[#111412] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800/60"
                    >
                      Inspect &amp; Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Match Candidate #${selected?.id ?? ""}`}
        subtitle={`Hybrid Score: ${selected?.match_score.toFixed(1) ?? "0"}%`}
        maxWidth="max-w-xl"
      >
        {selected && (
          <form onSubmit={handleSaveReview} className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {parsedDisclaimer}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="font-semibold text-zinc-100">Lost Report #{selected.lost_item_id}</p>
                <p className="mt-1 text-zinc-300">{selected.lost_item_description}</p>
                <p className="mt-1 text-zinc-400">Location: {selected.lost_location}</p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="font-semibold text-zinc-100">Found Item #{selected.found_item_id}</p>
                <p className="mt-1 text-zinc-300">{selected.found_item_description}</p>
                <p className="mt-1 text-zinc-400">Storage: {selected.storage_location || "—"}</p>
              </div>
            </div>

            {parsedSignals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-300 mb-1.5">Contributing Signals</p>
                <div className="divide-y divide-zinc-800/70 rounded-md border border-zinc-800">
                  {parsedSignals.map((sig, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-medium text-zinc-200">{sig.name}</span>
                      <span className="text-zinc-400">{sig.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Review Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm"
              >
                <option value="relevant">Relevant (Notify / Investigate)</option>
                <option value="investigating">Investigating</option>
                <option value="rejected">Not a Match (Reject)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Staff Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations from physical inspection..."
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-zinc-700 bg-[#111412] px-3.5 py-1.5 text-xs font-medium text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3.5 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Review
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

