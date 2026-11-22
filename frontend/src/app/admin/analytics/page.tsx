"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch } from "@/lib/api";
import type { EvaluationResponse } from "@/lib/types";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const runBenchmark = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<EvaluationResponse>("/api/evaluation/benchmark");
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runBenchmark();
  }, [runBenchmark]);

  return (
    <AppShell
      title="Matching Engine Analytics"
      subtitle="Empirical comparison of Baseline Keyword/Structured, Semantic Dense Vector (all-MiniLM-L6-v2), and Hybrid Multi-Signal ranking."
      action={
        <button
          type="button"
          onClick={runBenchmark}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary-hover px-3 py-1.5 text-xs font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Re-run Benchmark
        </button>
      }
    >
      {loading || !data ? (
        <LoadingState rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-[#111412] px-4 py-3 text-xs text-zinc-400">
            Dataset: <strong>{data.dataset_size.lost_items}</strong> lost queries evaluated against{" "}
            <strong>{data.dataset_size.found_items}</strong> found items (
            <strong>{data.dataset_size.ground_truth_pairs}</strong> ground-truth pairs).
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
            <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
              <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Approach</th>
                  <th className="px-4 py-3">Precision@1</th>
                  <th className="px-4 py-3">Precision@3</th>
                  <th className="px-4 py-3">Recall@1</th>
                  <th className="px-4 py-3">Recall@3</th>
                  <th className="px-4 py-3">MRR</th>
                  <th className="px-4 py-3">Avg Latency (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {Object.entries(data.metrics).map(([name, m]) => (
                  <tr key={name}>
                    <td className="px-4 py-3 font-medium text-zinc-100">{name}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{m["Precision@1"].toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{m["Precision@3"].toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{m["Recall@1"].toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{m["Recall@3"].toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-secondary">{m.MRR.toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{m.Avg_Latency_ms.toFixed(2)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

