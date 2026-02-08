import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/landing/Container";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Política de privacidade — Elemento Juris",
  description: "Política de privacidade do Elemento Juris."
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

export default function PrivacidadePage() {
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
          <h1 className="text-3xl font-semibold">Política de privacidade</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Esta política explica, de forma geral, como tratamos dados no Elemento Juris. Este documento é um modelo
            inicial e deve ser revisado por um profissional jurídico antes do uso comercial.
          </p>
          <p className="mt-3 text-xs text-white/60">Última atualização: 2026</p>
        </header>

        <main className="mt-8 max-w-3xl space-y-8">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. Princípios</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Valorizamos transparência, segurança e minimização de dados. Buscamos tratar informações pessoais com
              responsabilidade e respeitar as melhores práticas de privacidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. Quais dados podem ser tratados</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O sistema pode armazenar dados inseridos pelo escritório (tenant), como cadastro de usuários, clientes,
              processos e documentos. O conteúdo e a finalidade são definidos pelo próprio escritório.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. Finalidade</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O tratamento de dados ocorre para viabilizar funcionalidades do produto (ex.: autenticação, organização de
              processos, upload de documentos, geração de relatórios e suporte).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Segurança</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Adotamos boas práticas de autenticação e controle de acesso. Também buscamos manter rotinas de backup,
              monitoramento e auditoria para reduzir riscos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Compartilhamento</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Não vendemos dados pessoais. O compartilhamento, quando necessário, ocorre para viabilizar a operação do
              produto (ex.: serviços de e-mail/checkout) e deve ser limitado ao estritamente necessário.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Direitos do titular</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Caso você tenha dúvidas ou queira exercer direitos relacionados a dados, entre em contato pelo e-mail{" "}
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
            <h2 className="text-lg font-semibold">7. LGPD</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris é desenvolvido com preocupação de privacidade. O escritório (tenant) é responsável pelos
              dados inseridos e por definir bases legais e políticas internas de tratamento.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. Alterações</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Podemos atualizar esta política periodicamente. Recomendamos a revisão deste documento para acompanhar
              mudanças.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Referências</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Consulte também os <Link href="/termos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>Termos de utilização</Link>.
            </p>
          </section>
        </main>
      </Container>
    </div>
  );
}

