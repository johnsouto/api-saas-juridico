"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, params: Record<string, unknown>) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
};

export function Turnstile({ siteKey, onVerify, onExpire, onError, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const containerId = useMemo(() => `turnstile-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    if (!scriptLoaded) return;
    if (!containerRef.current) return;
    if (!window.turnstile?.render) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token: unknown) => {
        if (typeof token === "string") onVerify(token);
      },
      "expired-callback": () => {
        onExpire?.();
      },
      "error-callback": () => {
        onError?.();
      }
    });

    return () => {
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, [onError, onExpire, onVerify, scriptLoaded, siteKey]);

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div id={containerId} ref={containerRef} />
    </div>
  );
}

