"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingState } from "@/components/LoadingState";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { User, UserRole } from "@/lib/types";

export default function AdminRolesPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateRole = async (id: number, role: UserRole) => {
    try {
      await apiFetch(`/api/admin/users/${id}/role?role=${role}`, { method: "PUT" });
      showToast(`Role updated to ${role} and logged to audit trail.`, "success");
      loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role", "error");
    }
  };

  return (
    <AppShell
      title="Staff & Role Management"
      subtitle="Assign logical permissions (student, staff, admin). Every role change is recorded in audit_logs."
    >
      {loading ? (
        <LoadingState rows={4} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111412]">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-[#090B0A] text-xs font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Current Role</th>
                <th className="px-4 py-3 text-right">Assign Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{u.full_name}</p>
                    <p className="text-xs text-zinc-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.role} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                      className="rounded-md border border-zinc-700 bg-[#111412] px-2.5 py-1 text-xs"
                    >
                      <option value="student">student</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
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

