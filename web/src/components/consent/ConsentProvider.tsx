"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ConsentState } from "@/lib/consent";
import { getDefaultConsent, readConsent, writeConsent } from "@/lib/consent";

type ConsentContextValue = {
  consent: ConsentState | null;
  effective: ConsentState;
  showBanner: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  openManage: () => void;
  closeManage: () => void;
  isManageOpen: boolean;
  savePreferences: (next: ConsentState) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}

declare global {
  interface Window {
    __ej_gtm_loaded?: boolean;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function loadGTMOnce(gtmId: string) {
  if (typeof window === "undefined") return;
  if (window.__ej_gtm_loaded) return;
  window.__ej_gtm_loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
  document.head.appendChild(script);
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isManageOpen, setManageOpen] = useState(false);

  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const effective = consent ?? getDefaultConsent();

  useEffect(() => {
    const existing = readConsent();
    setConsent(existing);
    setInitialized(true);

    if (process.env.NODE_ENV === "production" && existing?.analytics && gtmId) {
      loadGTMOnce(gtmId);
    }
  }, [gtmId]);

  const acceptAll = React.useCallback(() => {
    const next: ConsentState = { necessary: true, analytics: true };
    writeConsent(next);
    setConsent(next);
    setManageOpen(false);

    if (process.env.NODE_ENV === "production" && gtmId) {
      loadGTMOnce(gtmId);
    }
  }, [gtmId]);

  const rejectAll = React.useCallback(() => {
    const next: ConsentState = { necessary: true, analytics: false };
    writeConsent(next);
    setConsent(next);
    setManageOpen(false);
  }, []);

  const savePreferences = React.useCallback((next: ConsentState) => {
    const normalized: ConsentState = { necessary: true, analytics: !!next.analytics };
    writeConsent(normalized);
    setConsent(normalized);
    setManageOpen(false);

    if (process.env.NODE_ENV === "production" && normalized.analytics && gtmId) {
      loadGTMOnce(gtmId);
    }
  }, [gtmId]);

  const openManage = React.useCallback(() => setManageOpen(true), []);
  const closeManage = React.useCallback(() => setManageOpen(false), []);

  const value = useMemo(
    () => ({
      consent,
      effective,
      showBanner: initialized && consent === null,
      acceptAll,
      rejectAll,
      openManage,
      closeManage,
      isManageOpen,
      savePreferences
    }),
    [acceptAll, closeManage, consent, effective, initialized, isManageOpen, openManage, rejectAll, savePreferences]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
