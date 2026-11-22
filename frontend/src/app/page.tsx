"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { roleDashboardPath, useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(roleDashboardPath(user.role));
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090B0A] text-sm text-zinc-400">
      Redirecting...
    </div>
  );
}

