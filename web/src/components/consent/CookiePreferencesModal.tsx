"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ConsentState } from "@/lib/consent";
import { useConsent } from "@/components/consent/ConsentProvider";

export default function CookiePreferencesModal() {
  const { isManageOpen, closeManage, effective, savePreferences } = useConsent();
  const [analytics, setAnalytics] = useState<boolean>(false);

  useEffect(() => {
    setAnalytics(!!effective.analytics);
  }, [effective.analytics, isManageOpen]);

  if (!isManageOpen) return null;

  const next: ConsentState = { necessary: true, analytics };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        aria-label="Fechar preferências de cookies"
        onClick={closeManage}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border/40 bg-background/95 p-5 text-foreground shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Preferências de Cookies</h2>
            <p className="mt-1 text-sm text-foreground/75">
              Você pode escolher quais cookies permitir. Cookies necessários são essenciais para o funcionamento do site.
            </p>
          </div>

          <button type="button" onClick={closeManage} className="rounded-lg px-2 py-1 text-foreground/70 hover:bg-muted/20">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Necessários</p>
                <p className="text-xs text-foreground/70">Sempre ativos</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">Ativo</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Analíticos</p>
                <p className="text-xs text-foreground/70">
                  Usados para melhorar a experiência (Google Tag Manager e Microsoft Clarity).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAnalytics((v) => !v)}
                className={[
                  "h-9 w-14 rounded-full border border-border/40 transition",
                  analytics ? "bg-[#234066]" : "bg-muted"
                ].join(" ")}
                aria-pressed={analytics}
                aria-label={analytics ? "Desativar cookies analíticos" : "Ativar cookies analíticos"}
              >
                <span
                  className={[
                    "block h-7 w-7 rounded-full bg-white transition",
                    analytics ? "translate-x-6" : "translate-x-1"
                  ].join(" ")}
                />
              </button>
            </div>
          </div>

          <p className="text-xs text-foreground/70">
            Leia nossa{" "}
            <Link href="/privacidade" className="underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeManage}
            className="h-10 rounded-xl border border-border/40 bg-card px-4 text-sm font-semibold hover:bg-muted/20"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => savePreferences(next)}
            className="h-10 rounded-xl bg-[#234066] px-4 text-sm font-semibold text-white shadow-[0_0_30px_rgba(35,64,102,0.45)] hover:shadow-[0_0_45px_rgba(35,64,102,0.60)]"
          >
            Salvar preferências
          </button>
        </div>
      </div>
    </div>
  );
}
