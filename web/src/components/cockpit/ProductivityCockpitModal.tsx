"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ProductivityCockpitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: AppTheme;
  officeName: string;
  firstName: string;
};

type ClockState = {
  dateBR: string; // dd/mm/aaaa
  timeBR: string; // HH:mm:ss
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

function getBrasiliaClockState(now: Date): ClockState {
  return { dateBR: DATE_FMT.format(now), timeBR: TIME_FMT.format(now) };
}

export function ProductivityCockpitModal({
  open,
  onOpenChange,
  theme,
  officeName,
  firstName
}: ProductivityCockpitModalProps) {
  const { toast } = useToast();
  const [animateIn, setAnimateIn] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    setAnimateIn(false);
    const raf = window.requestAnimationFrame(() => setAnimateIn(true));

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => ctaRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  const overlayBg = theme === "dark" ? "bg-black/45" : "bg-white/30";

  if (!open) return null;

  const safeOffice = officeName?.trim() ? officeName.trim() : "Seu escritório";
  const safeName = firstName?.trim() ? firstName.trim() : "Doutor(a)";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
        "transition-opacity duration-300 ease-out",
        animateIn ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Overlay */}
      <div
        className={cn("absolute inset-0 backdrop-blur-xl", overlayBg)}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cockpit de Produtividade"
        className={cn(
          "relative w-[95vw] max-w-2xl",
          "max-h-[85vh] overflow-y-auto",
          "rounded-2xl border border-border/15 bg-card/75 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl",
          "p-5 sm:p-7",
          animateIn ? "animate-ej-cockpit-pop" : "opacity-0"
        )}
      >
        {/* Close button (secondary) */}
        <button
          type="button"
          aria-label="Fechar"
          className={cn(
            "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg",
            "border border-border/15 bg-background/20 text-foreground/80 backdrop-blur",
            "transition-colors hover:bg-background/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border/15 bg-background/20 shadow-sm">
              <Image
                alt="Elemento Juris"
                src="/images/Logotipo.jpeg"
                fill
                sizes="48px"
                className="object-cover"
                priority={false}
              />
            </div>
            <div className="text-sm font-semibold tracking-tight">Elemento Juris</div>
          </div>

          {/* Copy */}
          <div className="mt-5 space-y-1">
            <div className="text-xs text-muted-foreground">Escritório: {safeOffice}</div>
            <div className="text-lg font-semibold sm:text-xl">Bem-vindo, Dr(a). {safeName}!</div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            A organização é o primeiro passo para o êxito judicial. Hoje é um ótimo dia para transformar pendências em
            decisões favoráveis. Sua pauta já está organizada.
          </p>

          {/* Clock */}
          <div className="mt-6 w-full">
            <BrasiliaFlipClock />
            <div className="mt-2 text-[11px] text-muted-foreground">Horário de Brasília</div>
          </div>

          {/* CTA */}
          <div className="mt-6 w-full">
            <button
              ref={ctaRef}
              type="button"
              className={cn(
                "group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5",
                "bg-gradient-to-b from-[#234066] to-[#0e1e2b] text-sm font-semibold text-white",
                theme === "dark" ? "border border-white/10" : "border border-black/10",
                "shadow-[0_0_40px_rgba(35,64,102,0.45)]",
                "transition duration-300 ease-out will-change-transform",
                "hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(35,64,102,0.60)] active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "ej-cta-pulse"
              )}
              onClick={() => {
                onOpenChange(false);
                toast("Bom trabalho, Doutor(a)!", { variant: "success" });
              }}
              aria-label="Iniciar expediente"
            >
              {/* sheen */}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-[-40%] w-[40%] -skew-x-[20deg]",
                  "bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0",
                  "transition duration-700 ease-out",
                  "group-hover:translate-x-[360%] group-hover:opacity-100"
                )}
              />

              <span>Iniciar Expediente</span>
              <span aria-hidden="true" className="text-white/75">
                →
              </span>
            </button>

            {/* Optional helper */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-background/10"
              >
                Continuar sem iniciar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrasiliaFlipClock() {
  const [clock, setClock] = useState<ClockState>(() => getBrasiliaClockState(new Date()));

  useEffect(() => {
    let alive = true;

    const tick = () => {
      if (!alive) return;
      setClock(getBrasiliaClockState(new Date()));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const chars = useMemo(() => clock.timeBR.split(""), [clock.timeBR]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-medium text-muted-foreground">{clock.dateBR}</div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        {chars.map((ch, idx) =>
          ch === ":" ? <FlipSeparator key={`sep-${idx}`} /> : <FlipDigit key={`d-${idx}`} value={ch} />
        )}
      </div>
    </div>
  );
}

const FlipSeparator = () => {
  return (
    <div
      className="mx-0.5 flex h-12 w-3 items-center justify-center text-lg font-semibold text-muted-foreground/70 sm:mx-1"
      aria-hidden="true"
    >
      :
    </div>
  );
};

const FlipDigit = (() => {
  function Component({ value }: { value: string }) {
    const [current, setCurrent] = useState<string>(value);
    const [next, setNext] = useState<string>(value);
    const [rot, setRot] = useState<number>(0);
    const [disableTransition, setDisableTransition] = useState<boolean>(false);

    useEffect(() => {
      if (value === current) return;
      setNext(value);
      setDisableTransition(false);
      setRot(180);

      const t = window.setTimeout(() => {
        setCurrent(value);
        // Reset angle without transition to prepare next flip.
        setDisableTransition(true);
        setRot(0);
        window.requestAnimationFrame(() => setDisableTransition(false));
      }, 520);

      return () => window.clearTimeout(t);
    }, [current, value]);

    return (
      <div
        className={cn(
          "relative h-12 w-9 select-none sm:h-14 sm:w-10",
          "rounded-lg border border-border/15 bg-background/20 shadow-sm backdrop-blur",
          "text-xl font-semibold tabular-nums sm:text-2xl"
        )}
        style={{ perspective: "900px" }}
        aria-label={value}
      >
        <div
          className={cn(
            "absolute inset-0 grid place-items-center",
            disableTransition ? "" : "transition-transform duration-500 ease-out motion-reduce:transition-none"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rot}deg)`
          }}
        >
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            {current}
          </div>
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
          >
            {next}
          </div>
        </div>
      </div>
    );
  }

  return Component;
})();
