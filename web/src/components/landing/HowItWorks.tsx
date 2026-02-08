import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

const steps = [
  {
    n: "1",
    title: "Crie sua conta",
    desc: "Comece no Free em poucos minutos, sem complicação."
  },
  {
    n: "2",
    title: "Organize clientes e processos",
    desc: "Cadastre clientes, gerencie processos, prazos e documentos."
  },
  {
    n: "3",
    title: "Ative o Plus",
    desc: "Quando estiver pronto, aumente limites e desbloqueie recursos avançados."
  }
];

export function HowItWorks() {
  return (
    <Section>
      <Container>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Como funciona</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              Um fluxo simples para você sair do caos e entrar no controle.
            </p>
          </div>

          <Link
            href="/login?mode=register&next=/dashboard"
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur",
              "hover:bg-white/10 transition-colors duration-300",
              focusRing
            )}
          >
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur",
                "transition-colors duration-300 hover:border-white/18"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#234066] text-white shadow-[0_0_30px_rgba(35,64,102,0.35)]">
                  <span className="text-sm font-bold">{s.n}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/70">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src="/images/product-shot-1.svg"
              alt="Visão do produto"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e2b]/70 via-transparent to-transparent" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
