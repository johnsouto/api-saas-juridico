import { Quote, Star } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { TiltCard } from "@/components/landing/TiltCard";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

const testimonials = [
  {
    title: "Cliente Plus — Escritório pequeno",
    quote:
      "Finalmente conseguimos padronizar cadastro de clientes e acompanhar prazos sem planilhas. O Plus vale pelo tempo que economiza."
  },
  {
    title: "Cliente Plus — Foco em produtividade",
    quote:
      "Ter tudo em um lugar só (processos, documentos e tarefas) trouxe mais previsibilidade e menos retrabalho."
  }
];

export function SocialProof() {
  return (
    <Section className="bg-gradient-to-b from-white/[0.02] to-white/0">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <RevealOnScroll from="left" className="lg:col-span-5">
            <p className="text-sm font-semibold text-white/80">Prova social</p>
            <div className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">+3.400 usuários</div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              Junte-se a mais de 3.400 profissionais e leve seu escritório para o próximo nível.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/75 backdrop-blur">
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </span>
              <span>Experiência premium para o jurídico</span>
            </div>
          </RevealOnScroll>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {testimonials.map((t, idx) => (
                <RevealOnScroll key={t.title} delayMs={idx * 120}>
                  <TiltCard>
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                      <Quote className="h-5 w-5 text-white/70" />
                    </div>
                    <div className="max-w-sm">
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      <p className="mt-3 text-sm leading-relaxed text-white/70">{t.quote}</p>
                    </div>
                  </div>
                  </TiltCard>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
