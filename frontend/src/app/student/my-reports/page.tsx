"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, FilePlus2, Pencil, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { Category, LostItem } from "@/lib/types";

export default function MyReportsPage() {
  const { showToast } = useToast();
  const [reports, setReports] = useState<LostItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Edit modal
  const [editing, setEditing] = useState<LostItem | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<LostItem[]>(`/api/lost-items?${params.toString()}`);
      setReports(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load reports", "error");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, showToast]);

  useEffect(() => {
    apiFetch<Category[]>("/api/admin/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const openEdit = (item: LostItem) => {
    setEditing(item);
    setEditDesc(item.item_description);
    setEditLoc(item.approximate_location);
    setEditDetails(item.distinctive_details || "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiFetch(`/api/lost-items/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          category_id: editing.category_id,
          location_id: editing.location_id,
          approximate_location: editLoc.trim(),
          lost_date_time: editing.lost_date_time,
          lost_time_range: editing.lost_time_range,
          item_description: editDesc.trim(),
          distinctive_details: editDetails.trim() || null,
          brand: editing.brand,
          primary_color: editing.primary_color,
          secondary_color: editing.secondary_color,
          image_url: editing.image_url,
        }),
      });
      showToast("Report updated and pgvector embedding refreshed.", "success");
      setEditing(null);
      loadReports();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="My Lost Reports"
      subtitle="View status updates and edit open lost-item reports."
      action={
        <Link
          href="/student/report-lost"
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          New Report
        </Link>
      }
    >
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-[#111412] p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your reports..."
            className="w-full rounded-md border border-zinc-700 pl-9 pr-3 py-1.5 text-sm focus:border-secondary focus:outline-none"
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
        <LoadingState rows={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No lost reports found"
          description="You haven't submitted any lost-item reports matching the current filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Last-Known Location</th>
                <th className="px-4 py-3">Date Lost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3 text-xs text-zinc-400">#{r.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{r.item_description}</p>
                    {r.distinctive_details && (
                      <p className="mt-0.5 text-xs text-zinc-400">Details: {r.distinctive_details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {r.category_name || categories.find((c) => c.id === r.category_id)?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{r.approximate_location}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(r.lost_date_time)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-[#111412] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800/60"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Locked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit Lost Report #${editing?.id ?? ""}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description *</label>
            <textarea
              required
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Last-Known Location *</label>
            <input
              type="text"
              required
              value={editLoc}
              onChange={(e) => setEditLoc(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Distinctive Details</label>
            <textarea
              rows={2}
              value={editDetails}
              onChange={(e) => setEditDetails(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

