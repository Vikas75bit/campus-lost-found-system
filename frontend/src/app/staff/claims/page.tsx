"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { Claim } from "@/lib/types";

export default function StaffClaimsPage() {
  const { showToast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [selected, setSelected] = useState<Claim | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "info_requested">("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status_filter", statusFilter);
      const data = await apiFetch<Claim[]>(`/api/claims?${params.toString()}`);
      setClaims(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load claims", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const openAssess = (c: Claim) => {
    setSelected(c);
    setDecision("approved");
    setNotes(c.staff_decision_notes || "");
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!notes.trim()) {
      showToast("Please record verification notes for the audit trail.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/claims/${selected.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ status: decision, staff_decision_notes: notes.trim() }),
      });
      showToast(
        decision === "approved"
          ? "Claim approved. Item moved to Awaiting Handover (still requires physical handover)."
          : `Claim marked as ${decision.replace("_", " ")}.`,
        "success"
      );
      setSelected(null);
      loadClaims();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit decision", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Claims Verification Queue"
      subtitle="Assess claimant evidence. Approving a claim marks the item Awaiting Handover—never Returned."
    >
      <div className="mb-4 flex justify-end">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-700 bg-[#111412] px-3 py-1.5 text-sm"
        >
          <option value="">All Claim Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="info_requested">Info Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : claims.length === 0 ? (
        <EmptyState title="No claims found" description="No ownership claims match the selected filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Claimant</th>
                <th className="px-4 py-3">Found Item &amp; Bin</th>
                <th className="px-4 py-3">Evidence &amp; Proof</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    #{c.id}
                    <div className="text-[11px] text-zinc-500">{formatDateTime(c.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium text-zinc-100">{c.claimant_name}</p>
                    <p className="text-zinc-400">{c.claimant_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium text-zinc-100">
                      #{c.found_item_id}: {c.found_item_description}
                    </p>
                    <p className="text-zinc-400">Bin: {c.storage_location || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs">
                    <p>{c.proof_evidence_notes}</p>
                    {c.distinctive_proof && (
                      <p className="mt-0.5 text-zinc-400">Confidential: {c.distinctive_proof}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {["submitted", "under_review", "info_requested"].includes(c.status) ? (
                      <button
                        type="button"
                        onClick={() => openAssess(c)}
                        className="rounded-md bg-secondary-hover px-2.5 py-1 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
                      >
                        Assess Evidence
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Reviewed</span>
                    )}
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
        title={`Assess Claim #${selected?.id ?? ""}`}
        subtitle={`Claimant: ${selected?.claimant_name ?? ""}`}
      >
        {selected && (
          <form onSubmit={handleSubmitDecision} className="space-y-4">
            <div className="rounded-md border border-zinc-800 bg-[#090B0A] p-3 text-xs space-y-1">
              <p>
                <strong>Claim description:</strong> {selected.claim_description}
              </p>
              <p>
                <strong>Supporting proof:</strong> {selected.proof_evidence_notes}
              </p>
              {selected.distinctive_proof && (
                <p>
                  <strong>Confidential detail:</strong> {selected.distinctive_proof}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Verification Decision *</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as "approved" | "rejected" | "info_requested")}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm"
              >
                <option value="approved">Approve Claim (Move to Awaiting Handover)</option>
                <option value="info_requested">Request Additional Evidence</option>
                <option value="rejected">Reject Claim</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Decision Notes *</label>
              <textarea
                required
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document verification findings or reason for decision..."
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
                Record Decision
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

