import { CreditCard, Landmark } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { TiltCard } from "@/components/landing/TiltCard";

function BrandPill({
  name,
  subtitle,
  Icon
}: {
  name: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <TiltCard>
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-white/10 bg-[#234066]/20 p-2.5">
          <Icon className="h-5 w-5 text-white/85" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
        </div>
      </div>
    </TiltCard>
  );
}

export function Payments() {
  return (
    <Section className="border-t border-white/10">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Formas de pagamento</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              Cartão de crédito e outras formas disponíveis no checkout.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
            Pagamento seguro
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BrandPill name="Stripe" subtitle="Checkout moderno para assinatura recorrente" Icon={CreditCard} />
          <BrandPill name="Mercado Pago" subtitle="Opções locais para facilitar a conversão" Icon={Landmark} />
        </div>
      </Container>
    </Section>
  );
}

