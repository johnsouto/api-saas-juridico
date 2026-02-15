import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/landing/Container";
import { LEGAL_VERSIONS } from "@/constants/legal";
import { SUPPORT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Política de privacidade — Elemento Juris",
  description: "Política de privacidade do Elemento Juris."
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

const LAST_UPDATED_BR = legalVersionToBr(LEGAL_VERSIONS.privacy);

export default function PrivacidadePage() {
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
          <h1 className="text-3xl font-semibold">Política de privacidade</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Esta política explica como o Elemento Juris coleta, utiliza, compartilha, protege e retém dados pessoais e
            dados operacionais no contexto do serviço SaaS.
          </p>
          <p className="mt-3 text-xs text-white/60">Última atualização: {LAST_UPDATED_BR}</p>
        </header>

        <nav className="mt-6 max-w-3xl rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white/90">Sumário</p>
          <ul className="mt-2 grid grid-cols-1 gap-2 text-sm text-white/75 sm:grid-cols-2">
            <li><a href="#quem-somos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.1 Quem somos</a></li>
            <li><a href="#dados-coletamos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.2 Dados que coletamos</a></li>
            <li><a href="#como-usamos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.3 Como usamos os dados</a></li>
            <li><a href="#base-legal" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.4 Base legal (LGPD)</a></li>
            <li><a href="#compartilhamento" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.5 Compartilhamento com operadores</a></li>
            <li><a href="#cookies-analytics" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.6 Cookies e Analytics</a></li>
            <li><a href="#seguranca" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.7 Armazenamento e Segurança</a></li>
            <li><a href="#retencao" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.8 Retenção</a></li>
            <li><a href="#direitos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.9 Direitos do titular</a></li>
            <li><a href="#exclusao-conta" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.10 Exclusão de conta</a></li>
            <li><a href="#contato" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>2.11 Contato</a></li>
          </ul>
        </nav>

        <main className="mt-8 max-w-3xl space-y-8">
          <section id="quem-somos" className="space-y-2">
            <h2 className="text-lg font-semibold">2.1 Quem somos</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O Elemento Juris é uma plataforma de gestão jurídica em modelo SaaS multi-tenant. Tratamos dados para
              viabilizar funcionalidades da operação do escritório, suporte, segurança e obrigações legais.
            </p>
          </section>

          <section id="dados-coletamos" className="space-y-2">
            <h2 className="text-lg font-semibold">2.2 Dados que coletamos</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                Dados de cadastro, como nome, e-mail, escritório e documento (CPF/CNPJ), quando aplicável ao fluxo.
              </li>
              <li>Dados de uso e segurança, como IP, user-agent e registros técnicos de auditoria de ações.</li>
              <li>
                Conteúdo do usuário inserido no tenant, incluindo clientes, processos, agenda, tarefas, honorários e
                documentos enviados.
              </li>
              <li>
                Dados de pagamento operacionais (status e identificadores do provedor). Não armazenamos dados sensíveis
                completos de cartão.
              </li>
            </ul>
          </section>

          <section id="como-usamos" className="space-y-2">
            <h2 className="text-lg font-semibold">2.3 Como usamos os dados</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>Prestação do serviço contratado e autenticação de usuários.</li>
              <li>Suporte, comunicação transacional e atendimento de solicitações.</li>
              <li>Segurança da plataforma, prevenção a fraude e investigação de incidentes.</li>
              <li>Melhoria de funcionalidades e desempenho do produto.</li>
              <li>Cumprimento de obrigações legais, regulatórias e fiscais.</li>
            </ul>
          </section>

          <section id="base-legal" className="space-y-2">
            <h2 className="text-lg font-semibold">2.4 Base legal (LGPD)</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O tratamento pode ocorrer com base em: execução de contrato, cumprimento de obrigação legal/regulatória,
              legítimo interesse (especialmente para segurança e antifraude) e consentimento, quando aplicável a recursos
              de analytics.
            </p>
          </section>

          <section id="compartilhamento" className="space-y-2">
            <h2 className="text-lg font-semibold">2.5 Compartilhamento com operadores</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Compartilhamos dados apenas quando necessário para operação do serviço, com provedores de infraestrutura,
              hospedagem, banco de dados, envio de e-mail (SMTP), armazenamento de arquivos (MinIO/S3), pagamento
              (Mercado Pago) e analytics (Google Tag Manager e Microsoft Clarity). Não vendemos dados pessoais.
            </p>
          </section>

          <section id="cookies-analytics" className="space-y-2">
            <h2 className="text-lg font-semibold">2.6 Cookies e Analytics</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Utilizamos Google Tag Manager (GTM) para gerenciamento de tags e Microsoft Clarity, via GTM, para análise
              de navegação e melhoria da experiência. Aplicamos boas práticas para evitar coleta indevida de dados
              sensíveis em formulários. Quando houver mecanismo de consentimento, ele poderá ser gerenciado pelo usuário.
            </p>
          </section>

          <section id="seguranca" className="space-y-2">
            <h2 className="text-lg font-semibold">2.7 Armazenamento e Segurança</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Adotamos medidas razoáveis de segurança técnica e organizacional, incluindo controle de acesso,
              monitoramento e trilhas de auditoria. Documentos enviados são armazenados em ambiente controlado com
              MinIO/S3.
            </p>
          </section>

          <section id="retencao" className="space-y-2">
            <h2 className="text-lg font-semibold">2.8 Retenção</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>Os dados são mantidos enquanto a conta estiver ativa ou conforme necessidade operacional.</li>
              <li>
                Em solicitação de exclusão, aplicamos fluxo em etapas com prazo de até 30 dias para processamento
                definitivo.
              </li>
              <li>Exportações completas do Plano Plus ficam disponíveis por 14 dias.</li>
              <li>
                Registros financeiros, fiscais e de auditoria podem ser retidos pelo período necessário para cumprimento
                de obrigações legais e exercício regular de direitos.
              </li>
            </ul>
          </section>

          <section id="direitos" className="space-y-2">
            <h2 className="text-lg font-semibold">2.9 Direitos do titular (LGPD)</h2>
            <p className="text-sm leading-relaxed text-white/70">
              O titular pode solicitar, quando aplicável, confirmação de tratamento, acesso, correção, portabilidade,
              oposição e eliminação de dados. Para exercer direitos, utilize os canais oficiais de suporte.
            </p>
          </section>

          <section id="exclusao-conta" className="space-y-2">
            <h2 className="text-lg font-semibold">2.10 Exclusão de conta</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                A exclusão ocorre em etapas: solicitação (<code>pending delete</code>) e finalização em até 30 dias.
              </li>
              <li>
                Plano Plus: pode gerar exportação completa assíncrona (ZIP), com validade de 14 dias e limite de 1
                solicitação por tenant a cada 24 horas.
              </li>
              <li>Plano Free: exportação manual dentro da plataforma durante a janela de acesso.</li>
              <li>
                Mesmo após exclusão definitiva, dados estritamente necessários podem ser mantidos para obrigações
                legais/fiscais, antifraude e defesa em processos.
              </li>
            </ul>
          </section>

          <section id="contato" className="space-y-2">
            <h2 className="text-lg font-semibold">2.11 Contato</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Para dúvidas sobre privacidade e solicitações relacionadas à LGPD:
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
              <li>
                Consulte também os{" "}
                <Link href="/termos" className={cn("underline decoration-white/30 hover:decoration-white/60", focusRing)}>
                  Termos de utilização
                </Link>
                .
              </li>
            </ul>
          </section>
        </main>
      </Container>
    </div>
  );
}
