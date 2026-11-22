"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { CampusLocation, Category, LostItem } from "@/lib/types";

export default function ReportLostItemPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [approximateLocation, setApproximateLocation] = useState("");
  const [lostDateTime, setLostDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [lostTimeRange, setLostTimeRange] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [distinctiveDetails, setDistinctiveDetails] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    apiFetch<Category[]>("/api/admin/categories").then(setCategories).catch(() => {});
    apiFetch<CampusLocation[]>("/api/admin/locations").then(setLocations).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      showToast("Please select an item category.", "error");
      return;
    }
    if (itemDescription.trim().length < 5) {
      showToast("Please provide a meaningful item description (at least 5 characters).", "error");
      return;
    }
    if (approximateLocation.trim().length < 3) {
      showToast("Please provide the last-known or approximate location.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<LostItem>("/api/lost-items", {
        method: "POST",
        body: JSON.stringify({
          category_id: Number(categoryId),
          location_id: locationId ? Number(locationId) : null,
          approximate_location: approximateLocation.trim(),
          lost_date_time: new Date(lostDateTime).toISOString(),
          lost_time_range: lostTimeRange.trim() || null,
          item_description: itemDescription.trim(),
          brand: brand.trim() || null,
          primary_color: primaryColor.trim() || null,
          secondary_color: secondaryColor.trim() || null,
          distinctive_details: distinctiveDetails.trim() || null,
          image_url: imageUrl.trim() || null,
        }),
      });
      showToast("Lost item report submitted and indexed for candidate matching.", "success");
      router.push("/student/my-reports");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit report.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Report Lost Item"
      subtitle="Provide item details and last-known location. Distinctive details are helpful but optional."
    >
      <div className="max-w-2xl rounded-lg border border-zinc-800 bg-[#111412] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
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
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Campus Zone / Building (Optional)
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="">Unspecified / Other</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.zone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Last-Known / Approximate Location *
            </label>
            <input
              type="text"
              required
              value={approximateLocation}
              onChange={(e) => setApproximateLocation(e.target.value)}
              placeholder="e.g. Central Library 2nd floor, near window study desks"
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Approximate Date &amp; Time Lost *
              </label>
              <input
                type="datetime-local"
                required
                value={lostDateTime}
                onChange={(e) => setLostDateTime(e.target.value)}
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Time Range (Optional)
              </label>
              <input
                type="text"
                value={lostTimeRange}
                onChange={(e) => setLostTimeRange(e.target.value)}
                placeholder="e.g. Morning (10am - 12pm)"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Item Description *
            </label>
            <textarea
              required
              rows={3}
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Describe the item clearly (model, material, contents, size)..."
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Dell, Sony"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Primary Color</label>
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="e.g. Black"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Secondary Color</label>
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="e.g. Silver"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>

          <div className="rounded-md border border-secondary/30 bg-secondary/10/50 p-3.5">
            <div className="flex items-start gap-2 mb-2">
              <Info className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-100">
                <strong>Distinctive Characteristics (Strongly Encouraged, Optional):</strong> Stickers, engravings, scratches, or keychains help staff verify ownership, though you may submit without them.
              </p>
            </div>
            <textarea
              rows={2}
              value={distinctiveDetails}
              onChange={(e) => setDistinctiveDetails(e.target.value)}
              placeholder="e.g. GitHub sticker on lid, small dent on bottom corner"
              className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Reference Image URL (Optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-800/70 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-zinc-700 bg-[#111412] px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Lost Report
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

