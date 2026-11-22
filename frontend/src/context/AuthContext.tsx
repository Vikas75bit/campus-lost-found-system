"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearClientSession, getStoredToken } from "@/lib/api";
import type { TokenResponse, User, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    department?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function roleDashboardPath(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/student";
}

function setSessionCookies(token: string, role: UserRole) {
  const maxAge = 60 * 60 * 8; // 8 hours matching JWT expiry
  document.cookie = `lf_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `lf_role=${encodeURIComponent(role)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<User>("/api/auth/me");
      setUser(me);
      localStorage.setItem("lf_user", JSON.stringify(me));
      setSessionCookies(token, me.role);
    } catch {
      clearClientSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<UserRole> => {
    const body = new URLSearchParams();
    body.set("username", email.trim().toLowerCase());
    body.set("password", password);

    const tokenData = await apiFetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    localStorage.setItem("lf_token", tokenData.access_token);
    setSessionCookies(tokenData.access_token, tokenData.role);

    const me = await apiFetch<User>("/api/auth/me");
    setUser(me);
    localStorage.setItem("lf_user", JSON.stringify(me));
    return me.role;
  };

  const register = async (payload: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    department?: string;
  }) => {
    await apiFetch<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const logout = async () => {
    try {
      if (getStoredToken()) {
        await apiFetch("/api/auth/logout", { method: "POST" });
      }
    } catch {
      // Ignore network error during logout; clear local session regardless
    } finally {
      clearClientSession();
      setUser(null);
      router.replace("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

