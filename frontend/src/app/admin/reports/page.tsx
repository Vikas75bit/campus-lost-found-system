"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, Pencil, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { FoundItem, LostItem } from "@/lib/types";

const LOST_STATUSES = ["open", "matched", "claim_pending", "resolved", "cancelled"] as const;
const FOUND_STATUSES = ["in_custody", "claim_pending", "awaiting_handover", "returned", "disposed"] as const;

type StatusModalTarget =
  | { kind: "lost"; id: number; description: string; currentStatus: string }
  | { kind: "found"; id: number; description: string; currentStatus: string };

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminReportsPage() {
  const { showToast } = useToast();
  const [lost, setLost] = useState<LostItem[]>([]);
  const [found, setFound] = useState<FoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // Modal state for status change with audit reason
  const [modalTarget, setModalTarget] = useState<StatusModalTarget | null>(null);
  const [modalStatus, setModalStatus] = useState("");
  const [modalReason, setModalReason] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [l, f] = await Promise.all([
        apiFetch<LostItem[]>("/api/lost-items"),
        apiFetch<FoundItem[]>("/api/found-items"),
      ]);
      setLost(l);
      setFound(f);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const submitStatusUpdate = async (
    kind: "lost" | "found",
    id: number,
    newStatus: string,
    reason?: string
  ) => {
    const key = `${kind}-${id}`;
    setUpdatingKey(key);
    try {
      const endpoint = kind === "lost" ? `/api/lost-items/${id}/status` : `/api/found-items/${id}/status`;
      const payload = { status: newStatus, reason: reason?.trim() || null };
      if (kind === "lost") {
        const updated = await apiFetch<LostItem>(endpoint, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setLost((prev) => prev.map((item) => (item.id === id ? updated : item)));
      } else {
        const updated = await apiFetch<FoundItem>(endpoint, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setFound((prev) => prev.map((item) => (item.id === id ? updated : item)));
      }
      showToast(
        `${kind === "lost" ? "Lost report" : "Found item"} #${id} updated to "${formatStatusLabel(newStatus)}" (logged & users notified).`,
        "success"
      );
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update status.", "error");
      return false;
    } finally {
      setUpdatingKey(null);
    }
  };

  const openReasonModal = (target: StatusModalTarget) => {
    setModalTarget(target);
    setModalStatus(target.currentStatus);
    setModalReason("");
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTarget || !modalStatus) return;
    setModalSaving(true);
    const ok = await submitStatusUpdate(modalTarget.kind, modalTarget.id, modalStatus, modalReason);
    setModalSaving(false);
    if (ok) {
      setModalTarget(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredLost = lost.filter((r) => {
    if (!q) return true;
    return (
      `#${r.id}`.includes(q) ||
      r.item_description.toLowerCase().includes(q) ||
      (r.user_name || "").toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });
  const filteredFound = found.filter((f) => {
    if (!q) return true;
    return (
      `#${f.id}`.includes(q) ||
      f.item_description.toLowerCase().includes(q) ||
      (f.storage_location || "").toLowerCase().includes(q) ||
      f.status.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell
      title="Reports & Inventory"
      subtitle="Manage status of lost reports and found custody items. Updates sync across all users and create audit entries."
    >
      <div className="mb-4 rounded-lg border border-zinc-800 bg-[#111412] p-3.5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ID, description, reporter, bin, or status..."
            className="w-full rounded-md border border-zinc-700 bg-[#090B0A] pl-9 pr-3 py-1.5 text-sm text-zinc-100 focus:border-secondary focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">
                Lost Reports ({filteredLost.length})
              </h2>
              <span className="text-xs text-zinc-400">Reporter is notified on status change</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Reporter</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Date Lost</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredLost.map((r) => {
                    const busy = updatingKey === `lost-${r.id}`;
                    return (
                      <tr key={r.id} className="hover:bg-zinc-800/40">
                        <td className="px-4 py-2.5 text-xs text-zinc-400">#{r.id}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300 whitespace-nowrap">
                          {r.user_name || `User #${r.user_id}`}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-zinc-100">
                          {r.item_description}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                          {formatDateTime(r.lost_date_time)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <select
                              aria-label={`Change status for lost report #${r.id}`}
                              value={r.status}
                              disabled={busy}
                              onChange={(e) => {
                                if (e.target.value !== r.status) {
                                  submitStatusUpdate("lost", r.id, e.target.value);
                                }
                              }}
                              className="rounded-md border border-zinc-700 bg-[#090B0A] px-2.5 py-1 text-xs text-zinc-200 focus:border-secondary focus:outline-none disabled:opacity-60"
                            >
                              {LOST_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {formatStatusLabel(s)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                openReasonModal({
                                  kind: "lost",
                                  id: r.id,
                                  description: r.item_description,
                                  currentStatus: r.status,
                                })
                              }
                              title="Update status with audit note"
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-[#111412] px-2 py-1 text-xs text-zinc-300 hover:border-secondary hover:text-secondary disabled:opacity-60"
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Pencil className="h-3 w-3" />
                              )}
                              Note
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#111412] overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">
                Found Items in Custody ({filteredFound.length})
              </h2>
              <span className="text-xs text-zinc-400">
                Affects student catalog visibility &amp; notifies staff/claimants
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Storage Bin</th>
                    <th className="px-4 py-2.5">Date Found</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredFound.map((f) => {
                    const busy = updatingKey === `found-${f.id}`;
                    return (
                      <tr key={f.id} className="hover:bg-zinc-800/40">
                        <td className="px-4 py-2.5 text-xs text-zinc-400">#{f.id}</td>
                        <td className="px-4 py-2.5 text-xs font-medium text-zinc-100">
                          {f.item_description}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300">
                          {f.storage_location || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                          {formatDateTime(f.found_date_time)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusBadge status={f.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <select
                              aria-label={`Change status for found item #${f.id}`}
                              value={f.status}
                              disabled={busy}
                              onChange={(e) => {
                                if (e.target.value !== f.status) {
                                  submitStatusUpdate("found", f.id, e.target.value);
                                }
                              }}
                              className="rounded-md border border-zinc-700 bg-[#090B0A] px-2.5 py-1 text-xs text-zinc-200 focus:border-secondary focus:outline-none disabled:opacity-60"
                            >
                              {FOUND_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {formatStatusLabel(s)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                openReasonModal({
                                  kind: "found",
                                  id: f.id,
                                  description: f.item_description,
                                  currentStatus: f.status,
                                })
                              }
                              title="Update status with audit note"
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-[#111412] px-2 py-1 text-xs text-zinc-300 hover:border-secondary hover:text-secondary disabled:opacity-60"
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Pencil className="h-3 w-3" />
                              )}
                              Note
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={modalTarget !== null}
        onClose={() => setModalTarget(null)}
        title={
          modalTarget
            ? `Update ${modalTarget.kind === "lost" ? "Lost Report" : "Found Item"} #${modalTarget.id}`
            : ""
        }
        subtitle="Changes are persisted to PostgreSQL, logged to status history & audit logs, and broadcast to affected users."
      >
        {modalTarget && (
          <form onSubmit={handleModalSubmit} className="space-y-4">
            <div className="rounded-md border border-zinc-800 bg-[#090B0A] px-3 py-2 text-xs text-zinc-300">
              {modalTarget.description}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">New Status</label>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#090B0A] px-3 py-2 text-sm text-zinc-100 focus:border-secondary focus:outline-none"
              >
                {(modalTarget.kind === "lost" ? LOST_STATUSES : FOUND_STATUSES).map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Audit Reason (optional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="Explain why the status is being updated (shown in status history & user notification)..."
                className="w-full rounded-md border border-zinc-700 bg-[#090B0A] px-3 py-2 text-sm text-zinc-100 focus:border-secondary focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalTarget(null)}
                className="rounded-md border border-zinc-700 bg-[#111412] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSaving || modalStatus === modalTarget.currentStatus}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-secondary-hover disabled:opacity-50"
              >
                {modalSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Apply Status Update
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

