"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bug } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BugReportPayload = {
  title: string;
  description: string;
  url?: string;
  user_agent?: string;
};

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeUrl, setIncludeUrl] = useState(true);
  const [includeUA, setIncludeUA] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const titleId = useId();
  const descId = useId();
  const dialogTitleId = useId();
  const titleRef = useRef<HTMLInputElement | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const payload: BugReportPayload = {
        title: title.trim(),
        description: description.trim()
      };
      if (includeUrl) payload.url = window.location.href;
      if (includeUA) payload.user_agent = navigator.userAgent;
      await api.post("/v1/feedback/bug", payload);
    },
    onSuccess: () => {
      setSuccessMsg("Obrigado! Seu bug report foi enviado.");
      setTitle("");
      setDescription("");
      setIncludeUrl(true);
      setIncludeUA(true);
    }
  });

  useEffect(() => {
    if (!open) return;
    setSuccessMsg(null);
    // Focus first input for better accessibility.
    const t = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        aria-label="Reportar um bug"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bug className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-0 flex items-start justify-center p-4 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              className="w-full max-w-lg rounded-2xl border border-border/20 bg-background p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={dialogTitleId} className="text-lg font-semibold">
                    Reportar um bug
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Descreva o problema. Isso nos ajuda a melhorar o Elemento Juris.
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setOpen(false)} type="button">
                  X
                </Button>
              </div>

              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (submit.isPending) return;
                  submit.mutate();
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor={titleId}>Título</Label>
                  <Input
                    ref={titleRef}
                    id={titleId}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Erro ao salvar processo"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={descId}>Descrição</Label>
                  <Textarea
                    id={descId}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="O que você estava fazendo? O que esperava acontecer? O que aconteceu?"
                    rows={5}
                    required
                  />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeUrl}
                      onChange={(e) => setIncludeUrl(e.target.checked)}
                    />
                    Incluir URL atual
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeUA}
                      onChange={(e) => setIncludeUA(e.target.checked)}
                    />
                    Incluir informações do navegador
                  </label>
                </div>

                {submit.isError ? (
                  <p className="text-sm text-destructive">
                    {(submit.error as any)?.response?.data?.detail ?? "Não foi possível enviar. Tente novamente."}
                  </p>
                ) : null}
                {successMsg ? <p className="text-sm text-emerald-600">{successMsg}</p> : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submit.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submit.isPending}>
                    {submit.isPending ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
