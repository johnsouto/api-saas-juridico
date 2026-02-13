"use client";

import { PRICING } from "@/constants/pricing";
import { cn } from "@/lib/utils";

type PlusPriceOfferProps = {
  variant?: "compact" | "full";
  showPerMonth?: boolean;
};

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: PRICING.plus.currency
});

export function PlusPriceOffer({ variant = "full", showPerMonth = true }: PlusPriceOfferProps) {
  const original = BRL_FORMATTER.format(PRICING.plus.originalMonthly);
  const current = BRL_FORMATTER.format(PRICING.plus.priceMonthly);

  return (
    <div className={cn("space-y-1", variant === "compact" ? "text-xs" : "text-sm")}>
      <p className="line-through opacity-70">De {original}</p>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "compact" ? "text-sm font-semibold" : "text-lg font-bold"
        )}
      >
        <span>
          Por {current}
          {showPerMonth ? "/mês" : ""}
        </span>
        <span className="rounded-full border border-[#234066]/30 bg-[#234066]/15 px-2 py-0.5 text-xs font-semibold text-[#234066] dark:border-[#234066]/60 dark:bg-[#234066]/35 dark:text-white">
          {PRICING.plus.labelOffer}
        </span>
      </div>
    </div>
  );
}
