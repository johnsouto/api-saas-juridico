import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";

const bullets = [
  "Boas práticas de autenticação e controle de acesso",
  "Monitoramento e backups",
  "Tratamento de dados alinhado à LGPD",
  "Transparência e compromisso com privacidade"
];

export function Security() {
  return (
    <Section className="border-y border-white/10 bg-gradient-to-b from-white/0 via-white/[0.02] to-white/0">
      <Container>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Segurança e conformidade para trabalhar com tranquilidade
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Um sistema jurídico precisa ser previsível e seguro. O Elemento Juris foi desenhado para reduzir risco e
              aumentar confiança — do acesso ao armazenamento de documentos.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-white/75">
              {bullets.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#234066]/35 text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-white">Compromisso</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                Levamos privacidade a sério. Nosso compromisso é manter transparência e melhorar continuamente práticas de
                segurança e conformidade.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#234066]/35 via-transparent to-transparent" />
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src="/images/security.svg"
                  alt="Segurança e LGPD"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e2b]/60 via-transparent to-transparent" />
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-10 -right-6 hidden h-40 w-40 rounded-full bg-[#234066]/25 blur-3xl lg:block" />
          </div>
        </div>
      </Container>
    </Section>
  );
}

