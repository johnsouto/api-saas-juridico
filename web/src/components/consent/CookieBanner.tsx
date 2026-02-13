"use client";

import Link from "next/link";

import CookiePreferencesModal from "@/components/consent/CookiePreferencesModal";
import { useConsent } from "@/components/consent/ConsentProvider";

export default function CookieBanner() {
  const { showBanner, acceptAll, rejectAll, openManage } = useConsent();

  if (!showBanner) return <CookiePreferencesModal />;

  return (
    <>
      <div className="fixed bottom-4 left-0 right-0 z-[9999] px-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border/40 bg-background/95 p-4 text-foreground shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Cookies e privacidade</p>
              <p className="text-foreground/80">
                Usamos cookies <b>necessários</b> para o funcionamento do site e, com sua permissão, cookies <b>analíticos</b>
                {" "} (Google Tag Manager e Microsoft Clarity) para melhorar sua experiência.{" "}
                <Link href="/privacidade" className="underline">
                  Política de Privacidade
                </Link>
              </p>
              <p className="mt-1 text-xs text-foreground/70">
                Bloqueio prévio ativo: tags de rastreio só serão carregadas após o aceite.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={rejectAll}
                className="h-10 rounded-xl border border-border/40 bg-card px-4 text-sm font-semibold hover:bg-muted/20"
              >
                Rejeitar
              </button>

              <button
                type="button"
                onClick={openManage}
                className="h-10 rounded-xl border border-border/40 bg-card px-4 text-sm font-semibold hover:bg-muted/20"
              >
                Gerenciar
              </button>

              <button
                type="button"
                onClick={acceptAll}
                className="h-10 rounded-xl bg-[#234066] px-4 text-sm font-semibold text-white shadow-[0_0_30px_rgba(35,64,102,0.45)] hover:shadow-[0_0_45px_rgba(35,64,102,0.60)] active:scale-[0.99]"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      </div>

      <CookiePreferencesModal />
    </>
  );
}
