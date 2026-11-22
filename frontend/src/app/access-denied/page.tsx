"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { roleDashboardPath, useAuth } from "@/context/AuthContext";

export default function AccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#090B0A] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-zinc-800 bg-[#111412] p-8 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-zinc-100">Access denied</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Your account role does not have permission to view this section.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
          {user ? (
            <>
              <Link
                href={roleDashboardPath(user.role)}
                className="rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
              >
                Go to my dashboard
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-zinc-700 bg-[#111412] px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/60"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

