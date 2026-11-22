"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { roleDashboardPath, useAuth } from "@/context/AuthContext";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both your campus email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const role = await login(email, password);
      const next = searchParams.get("next");
      if (next && next.startsWith(`/${role}`)) {
        router.replace(next);
      } else {
        router.replace(roleDashboardPath(role));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
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
            <p className="text-xs text-zinc-400">Campus Operations &amp; Custody Registry</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#111412] p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-100">Sign in to your account</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Use your university-issued credentials. Access is routed automatically based on your assigned role.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Campus Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-zinc-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-secondary hover:text-secondary-light"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-md border border-zinc-700 bg-[#111412] px-3 py-2 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800/70 pt-4 text-center text-xs text-zinc-400">
            New student on campus?{" "}
            <Link href="/register" className="font-medium text-secondary hover:text-secondary-light">
              Create a student account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090B0A]" />}>
      <LoginForm />
    </Suspense>
  );
}

