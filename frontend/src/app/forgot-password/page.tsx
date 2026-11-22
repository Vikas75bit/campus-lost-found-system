"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responseMsg, setResponseMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponseMsg(null);
    if (!email.trim()) {
      setError("Please enter your campus email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResponseMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090B0A] flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100 leading-tight">
              University Lost &amp; Found
            </h1>
            <p className="text-xs text-zinc-400">Password Recovery</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#111412] p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-100">Reset password</h2>
          <p className="mt-1 text-xs text-zinc-400 mb-5">
            Enter your campus email to log a password reset request in the system.
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {responseMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-secondary/30 bg-secondary/10 px-3 py-2.5 text-xs text-secondary">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{responseMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fpEmail" className="block text-xs font-medium text-zinc-300 mb-1">
                Campus Email
              </label>
              <input
                id="fpEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Request password reset
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800/70 pt-4 text-center text-xs text-zinc-400">
            <Link href="/login" className="font-medium text-secondary hover:text-secondary-light">
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

