"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateBR, formatDateTimeBR } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ExportStatus = {
  export_id: string;
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "EXPIRED";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string;
  file_size_bytes: number | null;
  error_message: string | null;
  downloaded_at: string | null;
  email_sent_at: string | null;
  note: string | null;
};

function statusLabel(status: ExportStatus["status"]): string {
  if (status === "PENDING") return "PENDENTE";
  if (status === "RUNNING") return "GERANDO";
  if (status === "READY") return "PRONTO";
  if (status === "FAILED") return "FALHOU";
  return "EXPIRADO";
}

function errorDetail(error: unknown, fallback: string): string {
  const maybe = error as { response?: { data?: { detail?: unknown } } };
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function ExportStatusPage() {
  const params = useParams<{ exportId: string }>();
  const exportId = params.exportId;

  const me = useQuery({
    queryKey: ["auth-me", "exports-page"],
    queryFn: async () => (await api.get("/v1/auth/me")).data,
    retry: false
  });

  const status = useQuery({
    queryKey: ["tenant-export-status", exportId],
    queryFn: async () => (await api.get<ExportStatus>(`/v1/exports/tenant/${exportId}/status`)).data,
    enabled: Boolean(exportId) && me.isSuccess,
    retry: false,
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      if (current === "PENDING" || current === "RUNNING") return 3000;
      return false;
    }
  });

  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(`/exports/${exportId}`)}`, [exportId]);

  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Exportação de dados</CardTitle>
            <CardDescription>Acompanhe o status da exportação completa do seu escritório.</CardDescription>
          </CardHeader>
        </Card>

        {me.isLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">Validando sessão…</CardContent>
          </Card>
        ) : null}

        {me.isError ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Faça login para continuar</CardTitle>
              <CardDescription>O download da exportação exige autenticação.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={loginHref}>Ir para login</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {me.isSuccess && status.isLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">Carregando status da exportação…</CardContent>
          </Card>
        ) : null}

        {me.isSuccess && status.isError ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              {errorDetail(status.error, "Não foi possível consultar a exportação.")}
            </CardContent>
          </Card>
        ) : null}

        {status.data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status: {statusLabel(status.data.status)}</CardTitle>
              <CardDescription>Export ID: {status.data.export_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Solicitada em:</span> {formatDateTimeBR(status.data.created_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Expira em:</span> {formatDateBR(status.data.expires_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Início:</span> {formatDateTimeBR(status.data.started_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Conclusão:</span> {formatDateTimeBR(status.data.finished_at)}
                </p>
              </div>

              {status.data.error_message ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  {status.data.error_message}
                </div>
              ) : null}

              {status.data.status === "RUNNING" || status.data.status === "PENDING" ? (
                <div className="rounded-lg border border-border/20 bg-card/40 p-3 text-muted-foreground">
                  A exportação está em processamento. Esta tela atualiza automaticamente.
                </div>
              ) : null}

              {status.data.status === "READY" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    onClick={() => {
                      window.location.assign(`/api/v1/exports/tenant/${status.data?.export_id}/download`);
                    }}
                  >
                    Baixar exportação
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Voltar ao dashboard</Link>
                  </Button>
                </div>
              ) : null}

              {status.data.status === "EXPIRED" ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-200">
                  Esta exportação expirou. Solicite uma nova exportação na área de Perfil.
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
