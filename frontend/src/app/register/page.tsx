"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        department: department.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
            <p className="text-xs text-zinc-400">Student Account Registration</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#111412] p-6 sm:p-8 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-100">Create student account</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Self-registration issues a standard Campus User / Student account. Staff and administrator privileges are assigned by an administrator.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-secondary/30 bg-secondary/10 px-3 py-2.5 text-xs text-secondary">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Account created. Redirecting to sign in...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-zinc-300 mb-1">
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div>
              <label htmlFor="regEmail" className="block text-xs font-medium text-zinc-300 mb-1">
                Campus Email *
              </label>
              <input
                id="regEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="department" className="block text-xs font-medium text-zinc-300 mb-1">
                  Department
                </label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Computer Science"
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-zinc-300 mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="regPassword" className="block text-xs font-medium text-zinc-300 mb-1">
                Password (min. 6 characters) *
              </label>
              <input
                id="regPassword"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-secondary-hover px-4 py-2 text-sm font-medium text-zinc-950 font-semibold hover:bg-secondary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating account..." : "Create student account"}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800/70 pt-4 text-center text-xs text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-secondary hover:text-secondary-light">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

