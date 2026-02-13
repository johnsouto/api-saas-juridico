import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

import { TrackedLink } from "@/components/analytics/TrackedLink";
import { Container } from "@/components/landing/Container";
import { Section } from "@/components/landing/Section";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function TrustChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
      <Check className="h-3.5 w-3.5 text-white/70" />
      <span>{label}</span>
    </div>
  );
}

export function Hero() {
  return (
    <Section className="pt-14 sm:pt-20">
      <Container>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              Premium • Jurídico • Cloud Nativo
            </p>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Gestão jurídica simples, segura e moderna para o seu escritório.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Organize processos, clientes e prazos com segurança, LGPD e suporte 24h. Comece no Free e evolua para o Plus
              quando quiser.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-auto px-5 py-3">
                <TrackedLink
                  href="/login?mode=register&next=/dashboard"
                  eventName="ej_landing_cta_click"
                  eventPayload={{ cta_name: "comecar_gratis", cta_location: "hero" }}
                >
                  Começar grátis <ArrowRight className="h-4 w-4" />
                </TrackedLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-auto border-white/15 bg-white/5 px-5 py-3 text-foreground/90 hover:bg-white/8 hover:border-white/25"
              >
                <TrackedLink
                  href="#planos"
                  eventName="ej_landing_cta_click"
                  eventPayload={{ cta_name: "ver_planos", cta_location: "hero" }}
                >
                  Ver planos
                </TrackedLink>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <TrustChip label="LGPD" />
              <TrustChip label="Segurança" />
              <TrustChip label="Backups" />
              <TrustChip label="Suporte 24h" />
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#234066]/35 via-transparent to-transparent" />
              <div className="absolute -inset-20 bg-[radial-gradient(circle,rgba(35,64,102,0.35),transparent_60%)] opacity-60" />

              <div
                className={cn(
                  "relative aspect-[16/11] w-full [transform-style:preserve-3d]",
                  "transition-transform duration-300 ease-out will-change-transform",
                  "hover:[transform:translateY(-6px)_rotateX(5deg)_rotateY(-6deg)]",
                  "motion-reduce:transition-none motion-reduce:hover:transform-none"
                )}
              >
                <Image
                  src="/images/fotoprincipal.jpg"
                  alt="Elemento Juris - Gestão jurídica simples e moderna"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e2b]/70 via-transparent to-transparent" />
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-8 -left-6 hidden h-32 w-32 rounded-3xl bg-[#234066]/30 blur-2xl lg:block" />
            <div className="pointer-events-none absolute -top-10 -right-10 hidden h-40 w-40 rounded-full bg-white/10 blur-3xl lg:block" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
