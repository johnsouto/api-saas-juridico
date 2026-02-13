"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  is_plus_effective: boolean;
};

export type TenantPlan = "free" | "plus";

export function usePlan(): {
  plan: TenantPlan;
  isPlus: boolean;
  isFree: boolean;
  isLoading: boolean;
} {
  const billing = useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    retry: false
  });

  const isPlus = Boolean(billing.data?.is_plus_effective);

  return {
    plan: isPlus ? "plus" : "free",
    isPlus,
    isFree: !isPlus,
    isLoading: billing.isLoading && !billing.data
  };
}
