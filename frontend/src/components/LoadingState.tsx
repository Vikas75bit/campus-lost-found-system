"use client";

import React from "react";

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-[#111412] p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-4 w-16 rounded bg-zinc-800" />
          <div className="h-4 flex-1 rounded bg-zinc-800" />
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="h-5 w-20 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

