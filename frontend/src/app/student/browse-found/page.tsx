"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { Category, FoundItem, LostItem } from "@/lib/types";

interface SemanticHit {
  found_item_id: number;
  category_id: number;
  category_name?: string | null;
  item_description: string;
  brand?: string | null;
  primary_color?: string | null;
  found_location_description: string;
  found_date_time: string;
  status: string;
  semantic_similarity_pct: number;
}

export default function BrowseFoundItemsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<FoundItem[]>([]);
  const [semanticHits, setSemanticHits] = useState<SemanticHit[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [myReports, setMyReports] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [useSemantic, setUseSemantic] = useState(false);

  // Claim modal state
  const [claimTargetId, setClaimTargetId] = useState<number | null>(null);
  const [claimTargetDesc, setClaimTargetDesc] = useState("");
  const [linkedLostId, setLinkedLostId] = useState("");
  const [claimDesc, setClaimDesc] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [distinctiveProof, setDistinctiveProof] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (useSemantic && search.trim().length >= 2) {
        const params = new URLSearchParams({ q: search.trim(), limit: "15" });
        if (categoryId) params.set("category_id", categoryId);
        const res = await apiFetch<{ results: SemanticHit[] }>(
          `/api/matching/semantic-search?${params.toString()}`
        );
        setSemanticHits(res.results);
      } else {
        setSemanticHits(null);
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (categoryId) params.set("category_id", categoryId);
        const data = await apiFetch<FoundItem[]>(`/api/found-items?${params.toString()}`);
        setItems(data);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load found items", "error");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, useSemantic, showToast]);

  useEffect(() => {
    apiFetch<Category[]>("/api/admin/categories").then(setCategories).catch(() => {});
    apiFetch<LostItem[]>("/api/lost-items").then(setMyReports).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openClaimModal = (id: number, desc: string) => {
    setClaimTargetId(id);
    setClaimTargetDesc(desc);
    setLinkedLostId("");
    setClaimDesc("");
    setProofNotes("");
    setDistinctiveProof("");
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTargetId) return;
    if (claimDesc.trim().length < 5 || proofNotes.trim().length < 5) {
      showToast("Please provide both a claim description and supporting evidence.", "error");
      return;
    }
    setSubmittingClaim(true);
    try {
      await apiFetch("/api/claims", {
        method: "POST",
        body: JSON.stringify({
          found_item_id: claimTargetId,
          lost_item_id: linkedLostId ? Number(linkedLostId) : null,
          claim_description: claimDesc.trim(),
          proof_evidence_notes: proofNotes.trim(),
          distinctive_proof: distinctiveProof.trim() || null,
        }),
      });
      showToast("Ownership claim submitted for staff verification.", "success");
      setClaimTargetId(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit claim.", "error");
    } finally {
      setSubmittingClaim(false);
    }
  };

  const rows = semanticHits
    ? semanticHits.map((h) => ({
        id: h.found_item_id,
        description: h.item_description,
        category: h.category_name || "Item",
        brandColor: [h.brand, h.primary_color].filter(Boolean).join(" · ") || "—",
        location: h.found_location_description,
        foundDate: h.found_date_time,
        status: h.status,
        simPct: h.semantic_similarity_pct,
      }))
    : items.map((i) => ({
        id: i.id,
        description: i.item_description,
        category: i.category_name || "Item",
        brandColor: [i.brand, i.primary_color].filter(Boolean).join(" · ") || "—",
        location: i.found_location_description,
        foundDate: i.found_date_time,
        status: i.status,
        simPct: null as number | null,
      }));

  return (
    <AppShell
      title="Browse Found Items"
      subtitle="Search items physically held in university custody. Confidential storage codes and finder contacts are masked."
    >
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-[#111412] p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              useSemantic
                ? "Describe your lost item in natural language (pgvector semantic search)..."
                : "Search by keyword, brand, or location..."
            }
            className="w-full rounded-md border border-zinc-700 pl-9 pr-3 py-1.5 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-[#111412] px-3 py-1.5 text-sm focus:border-secondary focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setUseSemantic((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            useSemantic
              ? "border-secondary bg-secondary/10 text-secondary"
              : "border-zinc-700 bg-[#111412] text-zinc-300 hover:bg-zinc-800/60"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {useSemantic ? "pgvector Semantic: On" : "pgvector Semantic: Off"}
        </button>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No found items match your filters"
          description="Try clearing your search or switching between keyword and pgvector semantic retrieval."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Found Location</th>
                <th className="px-4 py-3">Date Found</th>
                {useSemantic && <th className="px-4 py-3">Vector Similarity</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/60/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{r.description}</p>
                    <p className="text-xs text-zinc-400">{r.brandColor}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{r.category}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{r.location}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(r.foundDate)}
                  </td>
                  {useSemantic && (
                    <td className="px-4 py-3 text-xs font-medium text-secondary whitespace-nowrap">
                      {r.simPct !== null ? `${r.simPct.toFixed(1)}%` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openClaimModal(r.id, r.description)}
                      className="rounded-md border border-secondary px-2.5 py-1 text-xs font-medium text-secondary hover:bg-secondary/10"
                    >
                      Submit Claim
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={claimTargetId !== null}
        onClose={() => setClaimTargetId(null)}
        title="Submit Ownership Claim"
        subtitle={`Found Item #${claimTargetId}: ${claimTargetDesc}`}
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Link to Your Lost Report (Optional)
            </label>
            <select
              value={linkedLostId}
              onChange={(e) => setLinkedLostId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            >
              <option value="">None / Direct claim</option>
              {myReports.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  #{rep.id} — {rep.item_description.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Why do you believe this is your item? *
            </label>
            <textarea
              required
              rows={2}
              value={claimDesc}
              onChange={(e) => setClaimDesc(e.target.value)}
              placeholder="Explain when and where you lost it..."
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Supporting Evidence / Proof *
            </label>
            <textarea
              required
              rows={2}
              value={proofNotes}
              onChange={(e) => setProofNotes(e.target.value)}
              placeholder="Serial number, purchase receipt, ID inside wallet, lockscreen photo..."
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Confidential Distinctive Details (Optional)
            </label>
            <input
              type="text"
              value={distinctiveProof}
              onChange={(e) => setDistinctiveProof(e.target.value)}
              placeholder="Hidden marks or contents only the owner would know"
              className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClaimTargetId(null)}
              className="rounded-md border border-zinc-700 bg-[#111412] px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingClaim}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3.5 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
            >
              {submittingClaim && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit Claim
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

