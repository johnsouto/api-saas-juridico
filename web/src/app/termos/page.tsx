import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/landing/Container";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Termos de utilização — Elemento Juris",
  description: "Termos de utilização do Elemento Juris."
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#0e1e2b] text-white">
      <Container className="py-10">
        <Link
          href="/"
          className={cn(
            "inline-flex items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur",
            "hover:bg-white/10 transition-colors duration-300",
            focusRing
          )}
        >
          Voltar para a Home
        </Link>

        <header className="mt-8">
          <h1 className="text-3xl font-semibold">Termos de utilização</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Estes termos descrevem regras gerais de uso do Elemento Juris. Este documento é um modelo inicial e deve ser
            revisado por um profissional jurídico antes do uso comercial.
          </p>
          <p className="mt-3 text-xs text-white/60">Última atualização: 2026</p>
        </header>

        <main className="mt-8 max-w-3xl space-y-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. Aceitação</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Ao acessar e utilizar o Elemento Juris, você concorda com estes termos. Se você não concordar, não utilize
              o serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. Conta e acesso</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Você é responsável pela confidencialidade das credenciais e por todas as atividades realizadas na sua
              conta. Recomendamos o uso de senhas fortes e acesso restrito somente a pessoas autorizadas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. Uso permitido</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Você se compromete a utilizar o sistema de forma lícita, respeitando normas aplicáveis e direitos de
              terceiros. É proibido tentar explorar falhas, acessar dados de outros escritórios/tenants ou realizar ações
              que comprometam a disponibilidade do serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Conteúdo e documentos</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O usuário é responsável pelo conteúdo inserido no sistema, incluindo documentos anexados. O Elemento Juris
              não substitui políticas internas de organização e governança de dados do escritório.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Planos e pagamentos</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris pode oferecer planos (ex.: Free e Plus) com limites e funcionalidades distintas.
              Condições de cobrança, cancelamento e renovação devem ser apresentadas no checkout e/ou contrato comercial.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Disponibilidade</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Buscamos manter alta disponibilidade, porém manutenções e indisponibilidades podem ocorrer. Sempre que
              possível, comunicaremos janelas de manutenção.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Privacidade e LGPD</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Nosso compromisso é tratar dados com responsabilidade e transparência. Consulte também a{" "}
              <Link href="/privacidade" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                Política de privacidade
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Suporte</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O suporte pode variar conforme o plano contratado. Para contato, utilize o e-mail{" "}
              <a
                href="mailto:johnsouto216@gmail.com"
                className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}
              >
                johnsouto216@gmail.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Alterações</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Estes termos podem ser atualizados periodicamente. Recomendamos revisar este documento para acompanhar
              mudanças.
            </p>
          </section>
        </main>
      </Container>
    </div>
  );
}
