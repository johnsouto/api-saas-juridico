import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { TrackedLink } from "@/components/analytics/TrackedLink";
import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Como funciona</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Um fluxo simples para você sair do caos e entrar no controle.
            </p>
          </div>

          <Button asChild variant="outline" className="border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10">
            <TrackedLink
              href="/login?mode=register&next=/dashboard"
              eventName="ej_landing_cta_click"
              eventPayload={{ cta_name: "comecar_gratis", cta_location: "how_it_works" }}
            >
              Começar grátis <ArrowRight className="h-4 w-4" />
            </TrackedLink>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className={cn(
                "rounded-2xl border border-border/10 bg-card/30 p-6 backdrop-blur",
                "transition-colors duration-300 hover:border-border/18"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                  <span className="text-sm font-bold">{s.n}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-border/10 bg-card/30 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="relative aspect-[16/9] w-full">
            <Image
              src="/images/product-shot-1.svg"
              alt="Visão do produto"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
          </div>
        </div>

        <RevealOnScroll className="mt-10" from="bottom">
          <div className="overflow-hidden rounded-2xl border border-border/10 bg-card/30 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src="/images/dashboard.png"
                alt="Tela do dashboard do Elemento Juris"
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
          </div>
        </RevealOnScroll>
      </Container>
    </Section>
  );
}
