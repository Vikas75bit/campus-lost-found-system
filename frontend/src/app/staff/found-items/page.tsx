"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { CampusLocation, Category, FoundItem } from "@/lib/types";

export default function StaffFoundItemsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<FoundItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state
  const [openCreate, setOpenCreate] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [foundLocDesc, setFoundLocDesc] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [foundDateTime, setFoundDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [itemDescription, setItemDescription] = useState("");
  const [distinctiveDetails, setDistinctiveDetails] = useState("");
  const [brand, setBrand] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [finderName, setFinderName] = useState("");
  const [finderContact, setFinderContact] = useState("");
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<FoundItem[]>(`/api/found-items?${params.toString()}`);
      setItems(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load found items", "error");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, showToast]);

  useEffect(() => {
    apiFetch<Category[]>("/api/admin/categories").then(setCategories).catch(() => {});
    apiFetch<CampusLocation[]>("/api/admin/locations").then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !storageLocation.trim() || itemDescription.trim().length < 5) {
      showToast("Category, item description, and storage location are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/found-items", {
        method: "POST",
        body: JSON.stringify({
          category_id: Number(categoryId),
          location_id: locationId ? Number(locationId) : null,
          found_location_description: foundLocDesc.trim(),
          item_description: itemDescription.trim(),
          distinctive_details: distinctiveDetails.trim() || null,
          brand: brand.trim() || null,
          primary_color: primaryColor.trim() || null,
          found_date_time: new Date(foundDateTime).toISOString(),
          storage_location: storageLocation.trim(),
          finder_name: finderName.trim() || null,
          finder_contact: finderContact.trim() || null,
        }),
      });
      showToast("Found item recorded into physical custody and indexed with pgvector.", "success");
      setOpenCreate(false);
      setItemDescription("");
      setFoundLocDesc("");
      setStorageLocation("");
      setDistinctiveDetails("");
      setBrand("");
      setPrimaryColor("");
      setFinderName("");
      setFinderContact("");
      loadItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to record item.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Found Items Custody Registry"
      subtitle="Only staff-confirmed items physically received into the Lost & Found room are recorded here."
      action={
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
        >
          <Plus className="h-3.5 w-3.5" />
          Record Found Item
        </button>
      }
    >
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-[#111412] p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, brand, or found location..."
            className="w-full rounded-md border border-zinc-700 pl-9 pr-3 py-1.5 text-sm focus:border-secondary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-700 bg-[#111412] px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="in_custody">In Custody</option>
          <option value="claim_pending">Claim Pending</option>
          <option value="awaiting_handover">Awaiting Handover</option>
          <option value="returned">Returned</option>
          <option value="disposed">Disposed</option>
        </select>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="No found items" description="Record a physically received item to begin." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Item &amp; Details</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Found Location</th>
                <th className="px-4 py-3">Storage Bin</th>
                <th className="px-4 py-3">Finder</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3 text-xs text-zinc-400">#{item.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{item.item_description}</p>
                    {item.distinctive_details && (
                      <p className="mt-0.5 text-xs text-zinc-400">Marks: {item.distinctive_details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {item.category_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {item.found_location_description}
                    <div className="text-[11px] text-zinc-500">{formatDateTime(item.found_date_time)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-200 whitespace-nowrap">
                    {item.storage_location || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {item.finder_name || "Anonymous"}
                    {item.finder_contact && (
                      <div className="text-[11px] text-zinc-500">{item.finder_contact}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Record Found Item (Physical Custody)"
        subtitle="Confirm physical receipt and assign an internal storage coordinate."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm"
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Campus Zone</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm"
              >
                <option value="">Unspecified</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Found Location *</label>
              <input
                type="text"
                required
                value={foundLocDesc}
                onChange={(e) => setFoundLocDesc(e.target.value)}
                placeholder="e.g. Library Study Desk 42"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Storage Bin / Locker *
              </label>
              <input
                type="text"
                required
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="e.g. Locker Bin A-12"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Date &amp; Time Found *</label>
            <input
              type="datetime-local"
              required
              value={foundDateTime}
              onChange={(e) => setFoundDateTime(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Item Description *</label>
            <textarea
              required
              rows={2}
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Primary Color</label>
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Distinctive Details (Confidential to Staff)
            </label>
            <input
              type="text"
              value={distinctiveDetails}
              onChange={(e) => setDistinctiveDetails(e.target.value)}
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Finder Name</label>
              <input
                type="text"
                value={finderName}
                onChange={(e) => setFinderName(e.target.value)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Finder Contact</label>
              <input
                type="text"
                value={finderContact}
                onChange={(e) => setFinderContact(e.target.value)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
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
              Confirm Custody &amp; Save
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

