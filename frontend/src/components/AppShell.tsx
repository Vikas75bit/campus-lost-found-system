"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  Search,
  FileText,
  ClipboardCheck,
  Bell,
  UserCircle,
  PackageCheck,
  Sparkles,
  HandHeart,
  History,
  Users,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  BarChart3,
  LogOut,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, formatDateTime } from "@/lib/api";
import type { NotificationItem, UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [
    { label: "Dashboard", href: "/student", icon: LayoutDashboard },
    { label: "Report Lost Item", href: "/student/report-lost", icon: FilePlus2 },
    { label: "Browse Found Items", href: "/student/browse-found", icon: Search },
    { label: "My Reports", href: "/student/my-reports", icon: FileText },
    { label: "My Claims", href: "/student/my-claims", icon: ClipboardCheck },
    { label: "Notifications", href: "/student/notifications", icon: Bell },
    { label: "Profile", href: "/student/profile", icon: UserCircle },
  ],
  staff: [
    { label: "Overview", href: "/staff", icon: LayoutDashboard },
    { label: "Found Items", href: "/staff/found-items", icon: PackageCheck },
    { label: "Lost Reports", href: "/staff/lost-reports", icon: FileText },
    { label: "Match Review", href: "/staff/matches", icon: Sparkles },
    { label: "Claims", href: "/staff/claims", icon: ClipboardCheck },
    { label: "Handovers", href: "/staff/handovers", icon: HandHeart },
    { label: "Activity History", href: "/staff/history", icon: History },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Staff and Roles", href: "/admin/roles", icon: ShieldCheck },
    { label: "Reports", href: "/admin/reports", icon: FileText },
    { label: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  ],
};

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;
    apiFetch<NotificationItem[]>("/api/notifications")
      .then(setNotifications)
      .catch(() => {});
  }, [user, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090B0A] text-sm text-zinc-400">
        Loading workspace...
      </div>
    );
  }

  const navItems = NAV_BY_ROLE[user.role] || NAV_BY_ROLE.student;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#111412] border-r border-zinc-800">
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/15 border border-secondary/30 text-secondary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">Campus Lost &amp; Found</p>
          <p className="truncate text-[11px] text-zinc-400 capitalize">{user.role} Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-secondary/15 text-secondary border border-secondary/25"
                  : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100 border border-transparent"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-secondary" : "text-zinc-500"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <div className="mb-2.5 px-1">
          <p className="truncate text-xs font-medium text-zinc-100">{user.full_name}</p>
          <p className="truncate text-[11px] text-zinc-400">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 text-zinc-400" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#090B0A] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-60">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 w-64 max-w-xs h-full">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content column */}
      <div className="flex flex-1 flex-col lg:pl-60 min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800 bg-[#111412]/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm sm:text-base font-semibold text-zinc-100">{title}</h1>
              {subtitle && <p className="hidden sm:block truncate text-xs text-zinc-400">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {action}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-md border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-zinc-950">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg border border-zinc-800 bg-[#141816] shadow-xl z-40">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-3.5 py-2.5">
                    <span className="text-xs font-semibold text-zinc-100">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/80">
                    {notifications.length === 0 ? (
                      <p className="px-3.5 py-6 text-center text-xs text-zinc-500">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markRead(n.id)}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-zinc-800/60 transition-colors ${
                            n.is_read ? "opacity-65" : "bg-secondary/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-zinc-100">{n.title}</span>
                            {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{n.message}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">{formatDateTime(n.created_at)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

