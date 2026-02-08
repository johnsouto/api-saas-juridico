"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardSkeleton } from "@/components/auth/DashboardSkeleton";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const next = `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router, status]);

  if (status !== "authenticated") {
    return <DashboardSkeleton />;
  }

  return <>{children}</>;
}

