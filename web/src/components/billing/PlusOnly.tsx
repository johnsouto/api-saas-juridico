"use client";

import Link from "next/link";

import { PlusPriceOffer } from "@/components/billing/PlusPriceOffer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlusOnlyProps = {
  children: React.ReactNode;
  enabled: boolean;
  className?: string;
  title?: string;
  description?: string;
  ctaHref?: string;
};

export function PlusOnly({
  children,
  enabled,
  className,
  title = "Disponível no Plano Plus",
  description = "Desbloqueie o Dashboard completo e as Tarefas do Kanban.",
  ctaHref = "/billing?plan=plus&next=/dashboard"
}: PlusOnlyProps) {
  if (enabled) {
    if (!className) return <>{children}</>;
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none select-none blur-sm">{children}</div>

      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/75 p-4 backdrop-blur-[1px]">
        <div className="w-full max-w-sm rounded-xl border border-border/25 bg-card/90 p-4 text-center shadow-xl">
          <span className="inline-flex rounded-full border border-[#234066]/35 bg-[#234066]/20 px-3 py-1 text-xs font-semibold text-[#234066] dark:border-[#234066]/60 dark:bg-[#234066]/40 dark:text-white">
            Plus
          </span>
          <p className="mt-3 text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 inline-flex">
            <PlusPriceOffer variant="compact" />
          </div>
          <Button asChild className="mt-4 w-full shadow-glow">
            <Link href={ctaHref}>Assinar Plus</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
