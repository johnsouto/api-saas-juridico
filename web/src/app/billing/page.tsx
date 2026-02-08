import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/landing/Container";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assinar Plus — Elemento Juris",
  description: "Checkout do Plano Plus (R$47/mês)."
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

export default function BillingPage() {
  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
      <Container className="py-10">
        <Link
          href="/#planos"
          className={cn(
            "inline-flex items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur",
            "hover:bg-white/10 transition-colors duration-300",
            focusRing
          )}
        >
          Voltar para planos
        </Link>

        <header className="mt-8">
          <h1 className="text-3xl font-semibold">Assinar Plano Plus</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Página de checkout em implementação. O objetivo é integrar Stripe e Mercado Pago para pagamentos recorrentes.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm font-semibold text-white">Status</p>
            <p className="mt-2 text-sm text-white/70">
              Em implementação.
            </p>
            <div className="mt-6 rounded-xl border border-white/10 bg-[#1e1c1e]/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">TODO</p>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>Integrar checkout Stripe (assinatura mensal R$47)</li>
                <li>Integrar Mercado Pago (opções locais)</li>
                <li>Persistir assinatura em <code className="rounded bg-white/10 px-1 py-0.5">subscriptions</code></li>
                <li>Atualizar limites do plano do tenant após confirmação</li>
              </ul>
            </div>
          </div>

          <aside className="rounded-2xl border border-[#234066]/50 bg-gradient-to-b from-[#234066]/25 to-white/5 p-6 backdrop-blur">
            <p className="text-sm font-semibold text-white">Plano Plus</p>
            <p className="mt-1 text-3xl font-semibold text-white">R$47/mês</p>
            <p className="mt-2 text-sm text-white/70">Mais limites, prioridade no suporte e recursos avançados.</p>
            <Link
              href="/login?next=/dashboard"
              className={cn(
                "mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#234066] px-4 py-3 text-sm font-semibold text-white",
                "hover:bg-[#234066]/90 transition-colors duration-300",
                focusRing
              )}
            >
              Fazer login
            </Link>
          </aside>
        </div>
      </Container>
    </div>
  );
}
