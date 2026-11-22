"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch, formatDateTime } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>("/api/admin/users");
      setUsers(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleActive = async (id: number) => {
    try {
      await apiFetch(`/api/admin/users/${id}/toggle-active`, { method: "PUT" });
      showToast("User account status updated.", "success");
      loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update account", "error");
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Users" subtitle="Manage campus user accounts and active status.">
      <div className="mb-4 rounded-lg border border-zinc-800 bg-[#111412] p-3.5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email, or department..."
            className="w-full rounded-md border border-zinc-700 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{u.full_name}</p>
                    <p className="text-xs text-zinc-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{u.department || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.role} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`font-medium ${
                        u.is_active ? "text-secondary" : "text-red-400"
                      }`}
                    >
                      {u.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {formatDateTime(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(u.id)}
                      className="rounded-md border border-zinc-700 bg-[#111412] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800/60"
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

