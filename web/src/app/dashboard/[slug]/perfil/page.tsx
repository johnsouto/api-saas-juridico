"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { formatDateBR } from "@/lib/datetime";
import { formatCEP, formatCNPJ, formatCPF, isValidCEPLength, onlyDigits } from "@/lib/masks";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AddressFields } from "@/components/forms/AddressFields";

const schema = z.object({
  first_name: z.string().min(2, "Informe o primeiro nome.").max(200),
  last_name: z.string().min(2, "Informe o sobrenome.").max(200),
  oab_number: z.string().max(40).optional().or(z.literal("")),

  address_street: z.string().max(200).optional().or(z.literal("")),
  address_number: z.string().max(40).optional().or(z.literal("")),
  address_complement: z.string().max(200).optional().or(z.literal("")),
  address_neighborhood: z.string().max(120).optional().or(z.literal("")),
  address_city: z.string().max(120).optional().or(z.literal("")),
  address_state: z
    .string()
    .max(2)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: "UF inválida. Use 2 letras (ex: SP)." }),
  address_zip: z
    .string()
    .max(16)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidCEPLength(v), {
      message: "CEP incompleto. Informe 8 dígitos."
    })
});

type FormValues = z.infer<typeof schema>;

type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  status: "free" | "active" | "past_due" | "canceled" | "expired" | "trialing";
  current_period_end: string | null;
  grace_period_end: string | null;
  is_plus_effective: boolean;
  message: string | null;
};

type BillingCancelOut = {
  ok: boolean;
  message: string;
  cancel_at_period_end: boolean;
  access_until: string | null;
  refund_status: "NONE" | "PENDING_REVIEW" | string;
  export_requested: boolean;
  export_id: string | null;
  export_rate_limited: boolean;
  export_retry_after_seconds: number | null;
  latest_export_id: string | null;
};

type AccountDeleteOut = {
  ok: boolean;
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  delete_scheduled_for: string;
  export_requested: boolean;
  export_id: string | null;
  export_rate_limited: boolean;
  export_retry_after_seconds: number | null;
  latest_export_id: string | null;
};

const deleteReasonOptions = [
  { value: "encerramento", label: "Encerramento do escritório" },
  { value: "nao_atendeu", label: "Não atendeu às necessidades" },
  { value: "custo", label: "Custo" },
  { value: "outro", label: "Outro motivo" }
] as const;

function errorDetail(error: unknown, fallback: string): string {
  const maybe = error as { response?: { data?: { detail?: unknown } } };
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export default function PerfilPage() {
  const { user, tenant, refreshSession } = useAuth();
  const { toast } = useToast();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [generateExportOnCancel, setGenerateExportOnCancel] = useState(true);
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [deleteReasonText, setDeleteReasonText] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      oab_number: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: ""
    }
  });
  const zipDigits = onlyDigits(form.watch("address_zip") ?? "");
  const zipValid = !zipDigits || isValidCEPLength(zipDigits);

  const billing = useQuery({
    queryKey: ["billing-status", "perfil-risk-zone"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    retry: false
  });

  const isPlusEffective = useMemo(() => {
    if (!billing.data) return false;
    return billing.data.plan_code !== "FREE" && billing.data.is_plus_effective;
  }, [billing.data]);
  const periodEndLabel = billing.data?.current_period_end ? formatDateBR(billing.data.current_period_end) : "não informado";

  useEffect(() => {
    if (!user || !tenant) return;
    form.reset({
      first_name: user.first_name ?? (user.nome?.split(/\s+/).filter(Boolean)[0] ?? ""),
      last_name: user.last_name ?? "",
      oab_number: user.oab_number ?? "",
      address_street: tenant.address_street ?? "",
      address_number: tenant.address_number ?? "",
      address_complement: tenant.address_complement ?? "",
      address_neighborhood: tenant.address_neighborhood ?? "",
      address_city: tenant.address_city ?? "",
      address_state: tenant.address_state ?? "",
      address_zip: tenant.address_zip ? formatCEP(tenant.address_zip) : ""
    });
  }, [form, tenant, user]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        oab_number: values.oab_number ? values.oab_number : null,

        address_street: values.address_street ? values.address_street : null,
        address_number: values.address_number ? values.address_number : null,
        address_complement: values.address_complement ? values.address_complement : null,
        address_neighborhood: values.address_neighborhood ? values.address_neighborhood : null,
        address_city: values.address_city ? values.address_city : null,
        address_state: values.address_state ? values.address_state.toUpperCase() : null,
        address_zip: values.address_zip ? onlyDigits(values.address_zip) : null
      };
      const r = await api.patch("/v1/profile/me", payload);
      return r.data;
    },
    onSuccess: async () => {
      toast("Perfil atualizado com sucesso.", { variant: "success" });
      await refreshSession();
    }
  });

  const cancelSubscription = useMutation({
    mutationFn: async () =>
      (
        await api.post<BillingCancelOut>("/v1/billing/cancel", {
          generate_export_now: generateExportOnCancel
        })
      ).data,
    onSuccess: async (data) => {
      await billing.refetch();
      setCancelOpen(false);
      const accessUntil = data.access_until ? formatDateBR(data.access_until) : "não informado";
      toast(`${data.message} Acesso até: ${accessUntil}.`, { variant: "success" });
      if (data.export_requested && data.export_id) {
        toast("Exportação solicitada. Você receberá o link por e-mail quando estiver pronta.", { variant: "success" });
      }
      if (data.export_rate_limited) {
        toast("Novo export bloqueado por limite de 24h. Use o export mais recente.", { variant: "default" });
      }
    },
    onError: (error: unknown) => {
      toast(errorDetail(error, "Não foi possível cancelar a assinatura."), { variant: "error" });
    }
  });

  const requestDelete = useMutation({
    mutationFn: async () =>
      (
        await api.post<AccountDeleteOut>("/v1/account/delete-request", {
          confirm_text: deleteConfirmText,
          reason: deleteReason || undefined,
          reason_text: deleteReasonText || undefined
        })
      ).data,
    onSuccess: async (data) => {
      await refreshSession();
      setDeleteOpen(false);
      setDeleteAcknowledge(false);
      setDeleteConfirmText("");
      setDeleteReason("");
      setDeleteReasonText("");
      toast(`Solicitação registrada. Exclusão definitiva prevista para ${formatDateBR(data.delete_scheduled_for)}.`, {
        variant: "success"
      });
      if (data.export_requested && data.export_id) {
        toast("Exportação automática iniciada. Você receberá o link por e-mail.", { variant: "success" });
      } else if (data.plan_code === "FREE") {
        toast("Plano Free: faça o download manual dos seus dados em até 30 dias.", { variant: "default" });
      } else if (data.export_rate_limited) {
        toast("Exportação automática não gerada por limite de 24h. Use o export mais recente.", { variant: "default" });
      }
    },
    onError: (error: unknown) => {
      toast(errorDetail(error, "Não foi possível solicitar a exclusão da conta."), { variant: "error" });
    }
  });

  const deleteConfirmValid = deleteAcknowledge && deleteConfirmText.trim().toUpperCase() === "EXCLUIR";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Seus dados e informações do seu escritório.</CardDescription>
        </CardHeader>
      </Card>

      <form className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Primeiro nome</Label>
                <Input {...form.register("first_name")} />
                {form.formState.errors.first_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>Sobrenome</Label>
                <Input {...form.register("last_name")} />
                {form.formState.errors.last_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>E-mail</Label>
                <Input value={user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">O e-mail de login não pode ser alterado aqui por enquanto.</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Número da OAB</Label>
                <Input placeholder="Ex: SP 123456" {...form.register("oab_number")} />
                {form.formState.errors.oab_number ? (
                  <p className="text-xs text-destructive">{form.formState.errors.oab_number.message}</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do escritório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome do escritório</Label>
                <Input value={tenant?.nome ?? ""} disabled />
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={
                    tenant
                      ? `${tenant.tipo_documento.toUpperCase()} ${
                          tenant.tipo_documento === "cpf" ? formatCPF(tenant.documento) : formatCNPJ(tenant.documento)
                        }`
                      : ""
                  }
                  disabled
                />
              </div>
            </div>

            <AddressFields form={form} idPrefix="perfil" zipInvalid={Boolean(zipDigits && !zipValid)} />

            {save.isError ? (
              <div className="rounded-xl border border-border/20 bg-card/40 p-3 text-sm text-destructive">
                Não foi possível salvar o perfil.
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={save.isPending || !zipValid}>
                {save.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de risco</CardTitle>
          <CardDescription>
            Ações sensíveis com confirmação. Nenhuma delas remove dados imediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Plano atual:{" "}
            <span className="font-medium text-foreground">
              {billing.isLoading
                ? "Carregando…"
                : isPlusEffective
                  ? billing.data?.plan_code === "PLUS_ANNUAL_PIX"
                    ? "Plus Anual"
                    : "Plus Mensal"
                  : "Free"}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancelar assinatura
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              Excluir conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {cancelOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/60" onClick={() => (cancelSubscription.isPending ? null : setCancelOpen(false))} />
          <div className="relative mx-auto mt-16 w-[92vw] max-w-lg rounded-2xl border border-border/20 bg-card/95 p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Cancelar assinatura</h3>
            {isPlusEffective ? (
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p>
                  Sua assinatura será cancelada ao final do período já pago.
                  <br />
                  Você continuará com acesso ao Plano Plus até: <b>{periodEndLabel}</b>.
                </p>
                <label className="flex items-start gap-2 rounded-md border border-border/20 bg-background/50 p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border/40"
                    checked={generateExportOnCancel}
                    onChange={(e) => setGenerateExportOnCancel(e.target.checked)}
                  />
                  <span>Gerar exportação completa agora (recomendado).</span>
                </label>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Você está no Plano Free e não possui assinatura ativa.</p>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" onClick={() => setCancelOpen(false)} disabled={cancelSubscription.isPending}>
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (!isPlusEffective) {
                    setCancelOpen(false);
                    toast("Você está no Plano Free e não possui assinatura ativa.", { variant: "default" });
                    return;
                  }
                  cancelSubscription.mutate();
                }}
                disabled={cancelSubscription.isPending || billing.isLoading}
              >
                {cancelSubscription.isPending ? "Confirmando…" : "Confirmar cancelamento"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/60" onClick={() => (requestDelete.isPending ? null : setDeleteOpen(false))} />
          <div className="relative mx-auto mt-10 w-[94vw] max-w-2xl rounded-2xl border border-destructive/30 bg-card/95 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-destructive">Excluir conta (Zona de risco)</h3>

            {isPlusEffective ? (
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p>
                  Vamos gerar automaticamente uma exportação completa do seu escritório (dados + documentos organizados por cliente) e enviar por e-mail.
                  O link de download ficará disponível por 14 dias.
                </p>
                <p>
                  Após a solicitação, sua conta será marcada para exclusão e removida definitivamente após 30 dias.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p>
                  Antes de excluir sua conta, baixe manualmente seus dados e documentos dentro da plataforma.
                  Como sua conta Free tem poucos itens, a exportação é manual.
                </p>
                <p>Após solicitar a exclusão, você terá até 30 dias para acessar e baixar seus dados. Depois disso, sua conta será removida definitivamente.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/${tenant?.slug ?? ""}/documents`}>Ir para Documentos</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/${tenant?.slug ?? ""}/clients`}>Ir para Clientes</Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>Motivo (opcional)</Label>
                <Select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                  <option value="">Selecione</option>
                  {deleteReasonOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Detalhes (opcional)</Label>
                <Textarea
                  placeholder="Se quiser, detalhe o motivo."
                  value={deleteReasonText}
                  onChange={(e) => setDeleteReasonText(e.target.value)}
                  maxLength={1000}
                />
              </div>

              <label className="flex items-start gap-2 rounded-md border border-border/20 bg-background/50 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border/40"
                  checked={deleteAcknowledge}
                  onChange={(e) => setDeleteAcknowledge(e.target.checked)}
                />
                <span>Entendo que após a exclusão definitiva não será possível recuperar dados.</span>
              </label>

              <div className="space-y-1">
                <Label>
                  Para confirmar, digite: <b>EXCLUIR</b>
                </Label>
                <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="EXCLUIR" />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" onClick={() => setDeleteOpen(false)} disabled={requestDelete.isPending}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => requestDelete.mutate()}
                disabled={!deleteConfirmValid || requestDelete.isPending}
              >
                {requestDelete.isPending ? "Solicitando…" : "Solicitar exclusão"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
