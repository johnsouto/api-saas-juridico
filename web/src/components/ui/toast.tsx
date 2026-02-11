"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastOptions = {
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function toastClasses(variant: ToastVariant): string {
  if (variant === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-50";
  if (variant === "error") return "border-destructive/40 bg-destructive/15 text-foreground";
  return "border-border/20 bg-card/70 text-foreground";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const remove = React.useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) window.clearTimeout(t);
    timersRef.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const variant = options?.variant ?? "default";
      const durationMs = options?.durationMs ?? 2800;

      setItems((prev) => [...prev, { id, message, variant }]);

      const t = window.setTimeout(() => remove(id), durationMs);
      timersRef.current.set(id, t);
    },
    [remove]
  );

  const value = React.useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div
        className={cn(
          "pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[92vw] max-w-sm flex-col gap-2 sm:w-auto"
        )}
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start justify-between gap-3 rounded-xl border p-3 shadow-xl backdrop-blur",
              toastClasses(t.variant)
            )}
          >
            <p className="text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => remove(t.id)}
              className={cn(
                "rounded-md p-1 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "hover:bg-muted/10"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />");
  }
  return ctx;
}

