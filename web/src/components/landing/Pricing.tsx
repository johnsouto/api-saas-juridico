import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-white/75">
      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#234066]/35 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function Pricing() {
  return (
    <Section id="planos">
      <Container>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Planos e preços</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
              Comece no Free e evolua para o Plus quando quiser.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur">
            <Sparkles className="h-4 w-4 text-[#234066]" /> Plus pensado para conversão e crescimento
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors duration-300 hover:border-white/18">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Plano Free</p>
                <p className="mt-1 text-sm text-white/70">Para começar e validar o fluxo do escritório.</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold text-white">R$0</div>
                <div className="text-xs text-white/60">por mês</div>
              </div>
            </div>

            <ul className="mt-6 space-y-3">
              <Bullet>Cadastro de clientes e processos</Bullet>
              <Bullet>Agenda e tarefas básicas</Bullet>
              <Bullet>Documentos com limites do Free</Bullet>
              <Bullet>Exportação de relatório (.xlsx)</Bullet>
            </ul>

            <div className="mt-7">
              <Link
                href="/login?mode=register&next=/dashboard"
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur",
                  "hover:bg-white/10 transition-colors duration-300",
                  focusRing
                )}
              >
                Criar conta
              </Link>
            </div>
          </div>

          {/* Plus */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-[#234066]/60 bg-gradient-to-b from-[#234066]/30 via-white/5 to-white/5 p-6 backdrop-blur",
              "shadow-[0_0_0_1px_rgba(35,64,102,0.25),0_20px_90px_rgba(0,0,0,0.45)]",
              "transition-[transform,border-color,box-shadow] duration-300 ease-out",
              "hover:[transform:translateY(-6px)] hover:shadow-[0_0_0_1px_rgba(35,64,102,0.35),0_30px_120px_rgba(0,0,0,0.55)]",
              "motion-reduce:transition-none motion-reduce:hover:transform-none"
            )}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#234066]/35 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#234066] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_40px_rgba(35,64,102,0.45)]">
                  <Crown className="h-4 w-4" /> Mais popular
                </div>
                <p className="mt-3 text-sm font-semibold text-white">Plano Plus</p>
                <p className="mt-1 text-sm text-white/70">Limites maiores e recursos avançados para o escritório crescer.</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold text-white">R$47</div>
                <div className="text-xs text-white/60">por mês</div>
              </div>
            </div>

            <ul className="relative mt-6 space-y-3">
              <Bullet>Recursos avançados e evolução contínua</Bullet>
              <Bullet>Prioridade no suporte</Bullet>
              <Bullet>Mais limites de usuários e armazenamento</Bullet>
              <Bullet>Ferramentas extras e relatórios</Bullet>
              <Bullet>Mais GB para upload de documentos</Bullet>
              <Bullet>Mais clientes e processos para cadastrar</Bullet>
            </ul>

            <div className="relative mt-7">
              <Link
                href="/billing?plan=plus&next=/dashboard"
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-md bg-[#234066] px-4 py-3 text-sm font-semibold text-white",
                  "shadow-[0_0_44px_rgba(35,64,102,0.45)] hover:bg-[#234066]/90 hover:shadow-[0_0_64px_rgba(35,64,102,0.6)]",
                  "transition-all duration-300",
                  focusRing
                )}
              >
                Assinar Plus
              </Link>
              <p className="mt-3 text-center text-xs text-white/65">
                Checkout com Stripe e Mercado Pago (cartão de crédito e outras formas disponíveis).
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
