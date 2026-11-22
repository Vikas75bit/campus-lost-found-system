"use client";

import React from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-[#090B0A] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-zinc-800 bg-[#111412] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Clock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-zinc-100">Session expired</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Your authentication token is invalid or has expired. Please sign in again to continue.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}

