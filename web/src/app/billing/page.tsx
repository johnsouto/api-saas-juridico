import type { Metadata } from "next";
import { Suspense } from "react";

import { BillingClient } from "@/app/billing/BillingClient";

export const metadata: Metadata = {
  title: "Billing — Elemento Juris",
  description: "Escolha e gerencie o Plano Plus (R$47/mês ou R$499/ano via Pix)."
};

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <main className="theme-premium min-h-screen bg-background text-foreground">
          <div className="mx-auto max-w-4xl p-6 text-sm text-white/70">Carregando…</div>
        </main>
      }
    >
      <BillingClient />
    </Suspense>
  );
}
