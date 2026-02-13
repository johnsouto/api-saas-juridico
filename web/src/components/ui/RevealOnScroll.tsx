"use client";

import { CSSProperties } from "react";

import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";

type RevealDirection = "bottom" | "left" | "right";

type RevealOnScrollProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  from?: RevealDirection;
};

const hiddenStateByDirection: Record<RevealDirection, string> = {
  bottom: "translate-y-4",
  left: "-translate-x-4",
  right: "translate-x-4"
};

export function RevealOnScroll({
  children,
  className,
  delayMs = 0,
  from = "bottom"
}: RevealOnScrollProps) {
  const { ref, inView } = useInView<HTMLDivElement>({
    threshold: 0.15,
    rootMargin: "0px 0px -10% 0px",
    once: true
  });

  const style: CSSProperties | undefined = delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        inView ? "translate-x-0 translate-y-0 opacity-100 scale-100" : `opacity-0 scale-[0.99] ${hiddenStateByDirection[from]}`,
        className
      )}
    >
      {children}
    </div>
  );
}
