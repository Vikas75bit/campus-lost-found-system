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
import type { Claim, Handover } from "@/lib/types";

export default function StaffHandoversPage() {
  const { showToast } = useToast();
  const [approvedClaims, setApprovedClaims] = useState<Claim[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);

  const [targetClaim, setTargetClaim] = useState<Claim | null>(null);
  const [idType, setIdType] = useState("Student ID Card");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [claimsData, handoversData] = await Promise.all([
        apiFetch<Claim[]>("/api/claims?status_filter=approved"),
        apiFetch<Handover[]>("/api/handovers"),
      ]);
      const completedClaimIds = new Set(handoversData.map((h) => h.claim_id));
      setApprovedClaims(claimsData.filter((c) => !completedClaimIds.has(c.id)));
      setHandovers(handoversData);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load handover desk", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClaim) return;
    if (!idNumber.trim()) {
      showToast("Recipient ID number is required.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/handovers", {
        method: "POST",
        body: JSON.stringify({
          claim_id: targetClaim.id,
          recipient_id_type: idType,
          recipient_id_number: idNumber.trim(),
          handover_notes: notes.trim() || null,
          recipient_signature_acknowledged: acknowledged,
        }),
      });
      showToast("Physical handover recorded and case marked resolved.", "success");
      setTargetClaim(null);
      setIdNumber("");
      setNotes("");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Handover failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Physical Handover Desk"
      subtitle="Verify recipient photo ID in person and record physical return. Only completed handovers resolve a case."
    >
      {loading ? (
        <LoadingState rows={5} />
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Approved Claims Awaiting Physical Collection ({approvedClaims.length})
              </h2>
            </div>
            {approvedClaims.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No items awaiting handover"
                  description="Approved claims will appear here until the claimant collects the item in person."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                  <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Claim</th>
                      <th className="px-4 py-3">Claimant</th>
                      <th className="px-4 py-3">Found Item</th>
                      <th className="px-4 py-3">Storage Bin</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {approvedClaims.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-xs text-zinc-400">#{c.id}</td>
                        <td className="px-4 py-3 text-xs font-medium text-zinc-100">
                          {c.claimant_name} ({c.claimant_email})
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-300">
                          #{c.found_item_id}: {c.found_item_description}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-zinc-200">
                          {c.storage_location || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setTargetClaim(c)}
                            className="rounded-md bg-secondary-hover px-3 py-1 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
                          >
                            Record Handover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Completed Handover Ledger ({handovers.length})
              </h2>
            </div>
            {handovers.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No completed handovers" description="Recorded handovers appear here." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                  <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Handover ID</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">ID Verified</th>
                      <th className="px-4 py-3">Staff Officer</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {handovers.map((h) => (
                      <tr key={h.id}>
                        <td className="px-4 py-3 text-xs text-zinc-400">#{h.id}</td>
                        <td className="px-4 py-3 text-xs font-medium text-zinc-100">
                          {h.found_item_description || `Found #${h.found_item_id}`}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-300">{h.recipient_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          {h.recipient_id_type}: {h.recipient_id_number}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{h.staff_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                          {formatDateTime(h.handover_date_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        open={targetClaim !== null}
        onClose={() => setTargetClaim(null)}
        title={`Record Physical Handover (Claim #${targetClaim?.id ?? ""})`}
        subtitle={`Recipient: ${targetClaim?.claimant_name ?? ""}`}
      >
        <form onSubmit={handleRecordHandover} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">ID Document Type *</label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm"
            >
              <option value="Student ID Card">Student ID Card</option>
              <option value="National ID / Passport">National ID / Passport</option>
              <option value="Driver License">Driver License</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">ID Number *</label>
            <input
              type="text"
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. STU-2024-1049"
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Handover Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded border-zinc-700"
            />
            Recipient confirmed physical receipt and signed handover register.
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTargetClaim(null)}
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
              Complete Handover &amp; Resolve
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

