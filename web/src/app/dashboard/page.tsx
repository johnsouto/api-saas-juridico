"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardSkeleton } from "@/components/auth/DashboardSkeleton";

export default function DashboardIndexPage() {
  const { status, tenant } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!tenant?.slug) return;
    router.replace(`/dashboard/${tenant.slug}`);
  }, [router, status, tenant?.slug]);

  return <DashboardSkeleton />;
}

