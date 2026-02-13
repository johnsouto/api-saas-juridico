import Link from "next/link";

import { Container } from "@/components/landing/Container";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

function SocialIcon({
  href,
  label,
  children
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/85",
        "hover:bg-white/10 transition-colors duration-200",
        focusRing
      )}
    >
      {children}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0e1e2b]">
      <Container className="py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Elemento Juris</p>
            <p className="mt-2 max-w-sm text-sm text-white/70">
              Trabalhamos de acordo com as regras de LGPD. Transparência e compromisso com privacidade.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Legal</p>
            <Link href="/termos" className={cn("text-sm text-white/75 hover:text-white transition-colors", focusRing)}>
              Termos de utilização
            </Link>
            <Link
              href="/privacidade"
              className={cn("text-sm text-white/75 hover:text-white transition-colors", focusRing)}
            >
              Política de privacidade
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Redes sociais</p>
            <div className="flex gap-2">
              <SocialIcon href="https://www.linkedin.com/in/joaovitorlealsouto/" label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6.5 6.5A2.5 2.5 0 1 1 6.5 1.5a2.5 2.5 0 0 1 0 5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 9h7v12H3V9Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 9h7v12h-7V9Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 13c1.2-2 2.6-3 4.5-3 2 0 2.5 1.5 2.5 4v7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SocialIcon>
              <SocialIcon href="https://github.com/johnsouto" label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 19c-4 1.5-4-2.5-5-3m10 6v-3.5c0-1 .1-1.4-.5-2 2.5-.3 5-1.3 5-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1 .3-3.3 1.6a11.3 11.3 0 0 0-6 0C5.5 3.5 4.5 3.2 4.5 3.2a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 3.1 9.8c0 4.7 2.5 5.7 5 6-.5.6-.6 1-.6 2V22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SocialIcon>
              <SocialIcon href="https://www.instagram.com/elementojuris_oficial/" label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </SocialIcon>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center">
          <p>Direitos autorais © 2026 - Todos os direitos reservados</p>
          <p>Elemento Juris • Privacidade e LGPD</p>
        </div>
      </Container>
    </footer>
  );
}
