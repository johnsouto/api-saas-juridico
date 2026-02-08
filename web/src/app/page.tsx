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
  title: "Elemento Juris — Gestão Jurídica Premium",
  description:
    "Gestão jurídica simples, segura e moderna para o seu escritório. Comece no Free e evolua para o Plus (R$47/mês) quando quiser."
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0e1e2b] text-white">
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
