import type { Metadata } from "next";

import { LandingHeader } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Benefits } from "@/components/landing/Benefits";
import { Security } from "@/components/landing/Security";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SocialProof } from "@/components/landing/SocialProof";
import { Pricing } from "@/components/landing/Pricing";
import { Payments } from "@/components/landing/Payments";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Elemento Juris — Plataforma Jurídica para advogados e escritórios",
  description:
    "Organize clientes, parcerias, processos, documentos e tarefas em um painel moderno e seguro. Plano Free e Plus por R$47/mês.",
  openGraph: {
    title: "Elemento Juris — Plataforma Jurídica para advogados e escritórios",
    description:
      "Organize clientes, parcerias, processos, documentos e tarefas em um painel moderno e seguro. Plano Free e Plus por R$47/mês.",
    url: "https://elementojuris.cloud/",
    siteName: "Elemento Juris",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/images/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Elemento Juris — SaaS Jurídico"
      }
    ]
  }
};

export default function HomePage() {
  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(35,64,102,0.35),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_90%,rgba(35,64,102,0.22),transparent_50%)]" />
      </div>

      <LandingHeader />
      <main>
        <Hero />
        <Benefits />
        <Security />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <Payments />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
