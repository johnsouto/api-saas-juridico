import { CheckCircle2, Landmark, ShieldCheck } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { TiltCard } from "@/components/landing/TiltCard";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

const trustBullets = ["Pagamento protegido", "Pix e Cartão", "Confirmação automática"];

export function Payments() {
  return (
    <Section className="border-t border-white/10">
      <Container>
        <RevealOnScroll from="left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Formas de pagamento</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
                Checkout via Mercado Pago com proteção em toda a jornada de pagamento.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-[#234066]" /> Checkout seguro e confiável
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="mt-8" delayMs={120}>
          <TiltCard>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-[#234066]/20 p-2.5">
                  <Landmark className="h-5 w-5 text-white/85" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Mercado Pago</p>
                  <p className="mt-1 text-sm text-white/70">Checkout seguro e confiável</p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-white/80">
                {trustBullets.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#234066]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TiltCard>
        </RevealOnScroll>
      </Container>
    </Section>
  );
}
