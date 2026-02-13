"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

const faqs = [
  {
    q: "O Plano Free tem limite?",
    a: "Sim. O Free é ideal para começar e testar. O Plus aumenta limites de usuários e armazenamento e dá acesso a recursos avançados."
  },
  {
    q: "Como funciona o Plano Plus?",
    a: "O Plus está em oferta limitada: de R$97 por R$47/mês. Ele oferece limites maiores, prioridade no suporte e recursos avançados. Você pode começar no Free e ativar o Plus quando quiser."
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você pode cancelar a assinatura a qualquer momento. O acesso é mantido até o fim do ciclo de cobrança."
  },
  {
    q: "Meus dados estão seguros?",
    a: "Aplicamos boas práticas de autenticação, controle de acesso e armazenamento. Além disso, mantemos logs/auditoria e rotinas de backup."
  },
  {
    q: "O Elemento Juris segue a LGPD?",
    a: "O produto é desenvolvido com preocupação de privacidade e segurança. O escritório permanece responsável pelos dados inseridos e pelo uso adequado."
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "No checkout, você encontra cartão de crédito e outras formas disponíveis via Stripe e Mercado Pago."
  }
];

export function FAQ() {
  const uid = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section className="border-t border-white/10">
      <Container>
        <div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">FAQ</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
            Dúvidas comuns sobre planos, segurança e funcionamento.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            const buttonId = `${uid}-faq-btn-${idx}`;
            const panelId = `${uid}-faq-panel-${idx}`;

            return (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex((cur) => (cur === idx ? null : idx))}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
                    "text-sm font-semibold text-white hover:bg-white/5 transition-colors duration-200",
                    focusRing
                  )}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-white/70 transition-transform duration-300",
                      isOpen ? "rotate-180" : "rotate-0",
                      "motion-reduce:transition-none"
                    )}
                  />
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    "grid overflow-hidden px-5",
                    "transition-[grid-template-rows] duration-300 ease-out",
                    "motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr] pb-0"
                  )}
                >
                  <div className="min-h-0">
                    <p className="text-sm leading-relaxed text-white/70">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
