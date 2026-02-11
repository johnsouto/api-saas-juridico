"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { toast } = useToast();

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label ?? "Copiar"}
      className="h-8 w-8"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast("Copiado!", { variant: "success" });
        } catch {
          // Fallback: at least show something deterministic.
          toast("Não foi possível copiar automaticamente.", { variant: "error" });
        }
      }}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}

