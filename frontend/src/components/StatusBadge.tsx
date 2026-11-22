"use client";

import React from "react";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  in_custody: "bg-zinc-800 text-zinc-300 border-zinc-700",
  claim_pending: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  under_review: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  info_requested: "bg-orange-500/10 text-orange-400 border-orange-500/25",
  submitted: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  awaiting_handover: "bg-secondary/10 text-secondary border-secondary/30",
  approved: "bg-secondary/15 text-secondary border-secondary/30",
  returned: "bg-secondary/15 text-secondary border-secondary/30",
  resolved: "bg-secondary/15 text-secondary border-secondary/30",
  relevant: "bg-secondary/15 text-secondary border-secondary/30",
  investigating: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  unreviewed: "bg-zinc-800 text-zinc-400 border-zinc-700",
  rejected: "bg-red-500/10 text-red-400 border-red-500/25",
  cancelled: "bg-zinc-800/80 text-zinc-500 border-zinc-700",
  withdrawn: "bg-zinc-800/80 text-zinc-500 border-zinc-700",
  disposed: "bg-zinc-800/80 text-zinc-500 border-zinc-700",
  matched: "bg-secondary/15 text-secondary border-secondary/30",
  student: "bg-zinc-800 text-zinc-300 border-zinc-700",
  staff: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  admin: "bg-secondary/15 text-secondary border-secondary/30",
};

export function StatusBadge({ status }: { status: string }) {
  const key = (status || "").toLowerCase();
  const classes = STATUS_STYLES[key] || "bg-zinc-800 text-zinc-300 border-zinc-700";
  const label = key.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

