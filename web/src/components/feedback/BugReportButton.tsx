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
  const [formError, setFormError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [includeUrl, setIncludeUrl] = useState(true);
  const [includeUA, setIncludeUA] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const titleId = useId();
  const descId = useId();
  const dialogTitleId = useId();
  const dialogDescId = useId();
  const titleErrorId = useId();
  const descErrorId = useId();
  const titleRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  function validate(): boolean {
    const t = title.trim();
    const d = description.trim();

    const nextTitleError = t.length < 3 ? "Informe um título com pelo menos 3 caracteres." : null;
    const nextDescError = d.length < 10 ? "Informe uma descrição com pelo menos 10 caracteres." : null;

    setTitleError(nextTitleError);
    setDescriptionError(nextDescError);
    setFormError(nextTitleError || nextDescError ? "Preencha os campos obrigatórios." : null);

    return !nextTitleError && !nextDescError;
  }

  const isValid = title.trim().length >= 3 && description.trim().length >= 10;

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
      setFormError(null);
      setTitleError(null);
      setDescriptionError(null);
      setIncludeUrl(true);
      setIncludeUA(true);
    }
  });

  useEffect(() => {
    if (!open) return;
    setSuccessMsg(null);
    setFormError(null);
    setTitleError(null);
    setDescriptionError(null);
    // Ensure the top (title) is visible even on smaller desktop heights.
    dialogRef.current?.scrollTo({ top: 0 });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => setOpen(false)} />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescId}
            className={[
              "relative w-[95vw] max-w-xl",
              "max-h-[90vh] sm:max-h-[85vh] overflow-y-auto",
              "rounded-2xl border border-border/20 bg-background/95 shadow-xl backdrop-blur"
            ].join(" ")}
          >
            <div className="sticky top-0 z-10 border-b border-border/10 bg-background/95 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={dialogTitleId} className="text-lg font-semibold">
                    Reportar um bug
                  </h2>
                  <p id={dialogDescId} className="mt-1 text-sm text-muted-foreground">
                    Descreva o problema. Isso nos ajuda a melhorar o Elemento Juris.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <form
                className="space-y-3"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (submit.isPending) return;
                  if (!validate()) return;
                  submit.mutate();
                }}
              >
                {formError ? (
                  <p className="text-sm text-destructive">{formError}</p>
                ) : null}

                <div className="space-y-1">
                  <Label htmlFor={titleId}>Título</Label>
                  <Input
                    ref={titleRef}
                    id={titleId}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError) setTitleError(null);
                    }}
                    onBlur={() => {
                      const t = title.trim();
                      setTitleError(t.length < 3 ? "Informe um título com pelo menos 3 caracteres." : null);
                    }}
                    placeholder="Ex: Erro ao salvar processo"
                    aria-invalid={!!titleError}
                    aria-describedby={titleError ? titleErrorId : undefined}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Mínimo: 3 caracteres</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{Math.min(999, title.trim().length)}/3</p>
                  </div>
                  {titleError ? (
                    <p id={titleErrorId} className="text-xs text-destructive">
                      {titleError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor={descId}>Descrição</Label>
                  <Textarea
                    id={descId}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (descriptionError) setDescriptionError(null);
                    }}
                    onBlur={() => {
                      const d = description.trim();
                      setDescriptionError(d.length < 10 ? "Informe uma descrição com pelo menos 10 caracteres." : null);
                    }}
                    placeholder="O que você estava fazendo? O que esperava acontecer? O que aconteceu?"
                    className="min-h-[120px] resize-y sm:min-h-[160px]"
                    aria-invalid={!!descriptionError}
                    aria-describedby={descriptionError ? descErrorId : undefined}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Mínimo: 10 caracteres</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {Math.min(9999, description.trim().length)}/10
                    </p>
                  </div>
                  {descriptionError ? (
                    <p id={descErrorId} className="text-xs text-destructive">
                      {descriptionError}
                    </p>
                  ) : null}
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
                  <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={submit.isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submit.isPending || !isValid}>
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
