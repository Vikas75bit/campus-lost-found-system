"use client";

import React from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-[#111412] px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-zinc-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

