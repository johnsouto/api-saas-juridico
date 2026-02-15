import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/landing/Container";
import { LEGAL_VERSIONS } from "@/constants/legal";
import { SUPPORT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Termos de utilização — Elemento Juris",
  description: "Termos de utilização do Elemento Juris."
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

const SUPPORT_WHATSAPP_URL =
  "https://api.whatsapp.com/send?phone=5521976818750&text=Ol%C3%A1!%20Preciso%20de%20suporte%20no%20Elemento%20Juris.";

function legalVersionToBr(version: string): string {
  const [year, month, day] = version.split("-");
  if (!year || !month || !day) return version;
  return `${day}/${month}/${year}`;
}

const LAST_UPDATED_BR = legalVersionToBr(LEGAL_VERSIONS.terms);

export default function TermosPage() {
  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
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
            Estes termos regulam o uso do Elemento Juris por usuários e escritórios (tenants), incluindo regras de plano,
            billing, exportação de dados e exclusão de conta.
          </p>
          <p className="mt-3 text-xs text-white/60">Última atualização: {LAST_UPDATED_BR}</p>
        </header>

        <nav className="mt-6 max-w-3xl rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white/90">Sumário</p>
          <ul className="mt-2 grid grid-cols-1 gap-2 text-sm text-white/75 sm:grid-cols-2">
            <li><a href="#aceitacao" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.1 Aceitação dos Termos</a></li>
            <li><a href="#definicoes" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.2 Definições</a></li>
            <li><a href="#servico" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.3 Descrição do Serviço</a></li>
            <li><a href="#cadastro" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.4 Cadastro e Responsabilidades</a></li>
            <li><a href="#planos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.5 Planos e Limitações</a></li>
            <li><a href="#pagamentos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.6 Pagamentos (Plus)</a></li>
            <li><a href="#cancelamento" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.7 Cancelamento e Rebaixamento</a></li>
            <li><a href="#estorno" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.8 Arrependimento e Estornos</a></li>
            <li><a href="#exportacao" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.9 Exportação de Dados</a></li>
            <li><a href="#exclusao" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.10 Exclusão e Retenção</a></li>
            <li><a href="#disponibilidade" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.11 Disponibilidade e Segurança</a></li>
            <li><a href="#suporte" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.12 Suporte</a></li>
            <li><a href="#alteracoes" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.13 Alterações destes Termos</a></li>
            <li><a href="#foro" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>1.14 Foro e Legislação</a></li>
          </ul>
        </nav>

        <main className="mt-8 max-w-3xl space-y-8">
          <section id="aceitacao" className="space-y-2">
            <h2 className="text-lg font-semibold">1.1 Aceitação dos Termos</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Ao acessar ou utilizar o Elemento Juris, você declara que leu e concorda com estes Termos de Uso e com a{" "}
              <Link href="/privacidade" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                Política de privacidade
              </Link>
              .
            </p>
          </section>

          <section id="definicoes" className="space-y-2">
            <h2 className="text-lg font-semibold">1.2 Definições</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                <b>Elemento Juris</b>: plataforma SaaS de gestão jurídica.
              </li>
              <li>
                <b>Usuário</b>: pessoa com acesso à conta do escritório.
              </li>
              <li>
                <b>Tenant/Escritório</b>: ambiente isolado de cada cliente da plataforma.
              </li>
              <li>
                <b>Plano Free</b>: plano gratuito com limites operacionais.
              </li>
              <li>
                <b>Plano Plus</b>: plano pago com recursos e limites ampliados.
              </li>
              <li>
                <b>Conteúdo do Usuário</b>: dados inseridos pelo escritório (clientes, processos, agenda, tarefas e afins).
              </li>
              <li>
                <b>Documentos</b>: arquivos enviados para armazenamento no ambiente do tenant.
              </li>
            </ul>
          </section>

          <section id="servico" className="space-y-2">
            <h2 className="text-lg font-semibold">1.3 Descrição do Serviço</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris oferece gestão de clientes, processos, parcerias, agenda, tarefas, honorários e documentos
              em arquitetura SaaS multi-tenant. Cada assinatura está vinculada ao escritório (tenant), não a um usuário
              isolado.
            </p>
          </section>

          <section id="cadastro" className="space-y-2">
            <h2 className="text-lg font-semibold">1.4 Cadastro e Responsabilidades do Usuário</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>Manter dados cadastrais corretos e atualizados.</li>
              <li>Preservar confidencialidade de senha e acesso.</li>
              <li>Responder pelo conteúdo inserido no sistema e pelos documentos enviados.</li>
              <li>Não utilizar a plataforma para finalidades ilícitas, abusivas ou que violem direitos de terceiros.</li>
            </ul>
          </section>

          <section id="planos" className="space-y-2">
            <h2 className="text-lg font-semibold">1.5 Planos e Limitações</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Plano Free possui limites operacionais e atualmente permite até 3 clientes e 100 MB de armazenamento. O
              Plano Plus oferece recursos e limites ampliados. O Elemento Juris pode atualizar planos, limites e condições
              mediante comunicação prévia sempre que possível.
            </p>
          </section>

          <section id="pagamentos" className="space-y-2">
            <h2 className="text-lg font-semibold">1.6 Pagamentos (Plus) — Cartão Mensal e Pix Anual</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                <b>Cartão mensal</b>: renovação automática; ao cancelar, a renovação é interrompida e o acesso Plus é
                mantido até o fim do período já pago (<code>cancel_at_period_end</code>).
              </li>
              <li>
                <b>Pix anual</b>: acesso válido por 1 ano contado da confirmação do pagamento; após vencimento, a conta pode
                retornar ao Free até renovação.
              </li>
              <li>O valor efetivamente cobrado é o apresentado no checkout.</li>
            </ul>
          </section>

          <section id="cancelamento" className="space-y-2">
            <h2 className="text-lg font-semibold">1.7 Cancelamento e Rebaixamento</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O cancelamento solicita encerramento ao final do período pago. Após esse prazo, o tenant pode ser rebaixado
              para o Plano Free. Esse rebaixamento não implica remoção imediata dos dados, mas recursos exclusivos do Plus
              podem ficar indisponíveis.
            </p>
          </section>

          <section id="estorno" className="space-y-2">
            <h2 className="text-lg font-semibold">1.8 Direito de Arrependimento e Estornos (Brasil)</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Quando aplicável, o usuário poderá solicitar estorno dentro do prazo legal de 7 dias corridos após a
              contratação online. O processamento varia conforme o meio de pagamento:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>Cartão: estorno via operadora/adquirente.</li>
              <li>Pix: devolução pelo fluxo compatível com o provedor de pagamento.</li>
            </ul>
            <p className="text-sm leading-relaxed text-white/70">
              Solicitações podem passar por verificação e depender de prazos operacionais do meio de pagamento.
            </p>
          </section>

          <section id="exportacao" className="space-y-2">
            <h2 className="text-lg font-semibold">1.9 Exportação de Dados</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                <b>Plano Plus</b>: exportação completa (ZIP organizado + dados) gerada de forma assíncrona, disponível por
                e-mail e no app.
              </li>
              <li>O link de exportação Plus tem validade de 14 dias.</li>
              <li>Limite operacional: 1 exportação completa por tenant a cada 24 horas.</li>
              <li>
                <b>Plano Free</b>: exportação manual dentro da plataforma (ex.: downloads individuais), dentro da janela de
                acesso.
              </li>
              <li>O usuário é responsável por manter cópia local dos dados exportados.</li>
              <li>Para baixar o ZIP completo, é necessário estar autenticado no app.</li>
            </ul>
          </section>

          <section id="exclusao" className="space-y-2">
            <h2 className="text-lg font-semibold">1.10 Exclusão de Conta e Retenção (LGPD)</h2>
            <p className="text-sm leading-relaxed text-white/70">
              A exclusão de conta ocorre em etapas: solicitação com marcação de pendência (<code>pending delete</code>) e
              prazo de até 30 dias para finalização. Durante esse período, o usuário pode baixar seus dados (Free: manual;
              Plus: exportação completa).
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              Após a exclusão definitiva, os dados podem ser removidos ou anonimizados, incluindo documentos armazenados em
              ambiente MinIO/S3, respeitando as rotinas de limpeza.
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris pode manter dados estritamente necessários para cumprimento legal/regulatório, prevenção a
              fraude, exercício regular de direitos e preservação de registros financeiros/fiscais.
            </p>
          </section>

          <section id="disponibilidade" className="space-y-2">
            <h2 className="text-lg font-semibold">1.11 Disponibilidade, Segurança e Limitações</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris adota medidas razoáveis de segurança e busca alta disponibilidade, mas não garante operação
              ininterrupta ou livre de falhas. Manutenções e indisponibilidades pontuais podem ocorrer. A responsabilidade
              da plataforma é limitada aos termos legais aplicáveis e à natureza do serviço contratado.
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              Para segurança e conformidade, podemos manter registros técnicos de auditoria (como IP, user-agent e eventos
              críticos de conta), conforme descrito na{" "}
              <Link href="/privacidade" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                Política de privacidade
              </Link>
              .
            </p>
          </section>

          <section id="suporte" className="space-y-2">
            <h2 className="text-lg font-semibold">1.12 Suporte</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O suporte é prestado em regime de melhor esforço, pelos canais oficiais:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                E-mail:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                WhatsApp:{" "}
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                  suporte Elemento Juris
                </a>
              </li>
            </ul>
          </section>

          <section id="alteracoes" className="space-y-2">
            <h2 className="text-lg font-semibold">1.13 Alterações destes Termos</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Estes Termos podem ser atualizados para refletir melhorias do serviço, mudanças legais ou ajustes
              operacionais. Sempre que possível, comunicaremos alterações relevantes com antecedência.
            </p>
          </section>

          <section id="foro" className="space-y-2">
            <h2 className="text-lg font-semibold">1.14 Foro e Legislação</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca do domicílio do
              consumidor, quando aplicável, sem prejuízo das hipóteses legais de competência.
            </p>
          </section>
        </main>
      </Container>
    </div>
  );
}
