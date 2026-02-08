import { Clock, FileText, Headset, Lock, Scale, Sparkles, Users } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { TiltCard } from "@/components/landing/TiltCard";

type Benefit = {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const benefits: Benefit[] = [
  {
    title: "Controle de prazos",
    description: "Agenda e tarefas para manter audiências, reuniões e entregas sob controle.",
    Icon: Clock
  },
  {
    title: "Gestão de clientes e casos",
    description: "Organize clientes, processos e documentos em um fluxo simples e eficiente.",
    Icon: Users
  },
  {
    title: "Acesso seguro e permissões",
    description: "RBAC por perfil (admin/advogado/financeiro) e acesso isolado por escritório.",
    Icon: Lock
  },
  {
    title: "Dados protegidos (LGPD)",
    description: "Boas práticas de segurança, auditoria e controle de acesso para trabalhar com tranquilidade.",
    Icon: Scale
  },
  {
    title: "Suporte 24h",
    description: "Canal de atendimento para te acompanhar na operação e tirar dúvidas rapidamente.",
    Icon: Headset
  },
  {
    title: "Evolução contínua",
    description: "Atualizações frequentes, melhorias e novos recursos para o escritório crescer.",
    Icon: Sparkles
  }
];

export function Benefits() {
  return (
    <Section>
      <Container>
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Benefícios que viram rotina no escritório</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              Um sistema premium, jurídico e moderno — pensado para organização, produtividade e segurança.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <TiltCard key={b.title}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-[#234066]/20 p-2.5 shadow-[0_0_0_1px_rgba(35,64,102,0.25)]">
                  <b.Icon className="h-5 w-5 text-white/85" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{b.description}</p>
                </div>
              </div>
            </TiltCard>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-6 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <FileText className="h-5 w-5 text-white/80" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Relatórios e exportação</p>
                <p className="text-sm text-white/70">Exporte uma visão do escritório em planilha (.xlsx) quando precisar.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
              Pronto para o Plus
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

