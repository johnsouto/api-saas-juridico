"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardSkeleton } from "@/components/auth/DashboardSkeleton";

export default function DashboardClienteDetailAliasPage() {
  const { status, tenant } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!tenant?.slug) return;
    if (!params.id) return;
    router.replace(`/dashboard/${tenant.slug}/clients/${params.id}`);
  }, [params.id, router, status, tenant?.slug]);

  return <DashboardSkeleton />;
}

