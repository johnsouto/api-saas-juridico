import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
  variants: {
    variant: {
      default: "border-border/15 bg-card/40 text-foreground",
      secondary: "border-border/10 bg-muted/10 text-foreground",
      success: "border-transparent bg-emerald-100 text-emerald-900",
      warning: "border-transparent bg-amber-100 text-amber-900",
      destructive: "border-transparent bg-red-100 text-red-900"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
