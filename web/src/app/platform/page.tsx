"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/datetime";
import { clearPlatformAdminSession, getPlatformSessionState, lockPlatformAdminSession } from "@/lib/platformAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type PlatformOverviewTopTenant = {
  tenant_id: string;
  tenant_nome: string;
  tenant_slug: string;
  value: number;
};

type PlatformOverviewRecentTenant = {
  tenant_id: string;
  tenant_nome: string;
  tenant_slug: string;
  created_at: string;
};

type PlatformOverviewOut = {
  tenants_total: number;
  users_total: number;
  tenants_free: number;
  tenants_plus: number;
  storage_used_bytes_total: number;
  top_storage_tenants: PlatformOverviewTopTenant[];
  top_volume_tenants: PlatformOverviewTopTenant[];
  recent_tenants: PlatformOverviewRecentTenant[];
};

type PlatformTenantListItem = {
  id: string;
  nome: string;
  cnpj?: string | null;
  tipo_documento: string;
  documento: string;
  slug: string;
  criado_em: string;
  is_active: boolean;

  admin_email: string | null;
  admin_nome: string | null;
  admin_is_active: boolean | null;

  users_total: number;
  users_active: number;
  clients_total: number;
  processes_total: number;
  storage_used_bytes: number;
  storage_limit_bytes: number | null;
  storage_percent_used: number | null;

  plan_code?: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX" | null;
  plan_nome?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  grace_period_end?: string | null;
  provider?: string | null;

  max_clients_override?: number | null;
  max_storage_mb_override?: number | null;
};

type PlatformTenantCreatedOut = {
  tenant: { id: string; nome: string; cnpj?: string | null; slug: string; criado_em: string };
  admin_user: { id: string; nome: string; email: string; role: string };
  tokens: { access_token: string; refresh_token: string };
};

type PlatformResendInviteOut = {
  message: string;
  email: string;
};

type PlatformTenantStatusOut = {
  message: string;
  tenant_id: string;
  is_active: boolean;
};

type PlatformTenantDeletedOut = {
  message: string;
  tenant_id: string;
};

type PlatformTenantLimitsOut = {
  message: string;
  tenant_id: string;
  max_clients_override: number | null;
  max_storage_mb_override: number | null;
};

type PlatformTenantSubscriptionOut = {
  message: string;
  tenant_id: string;
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  status: "free" | "active" | "past_due" | "expired" | "canceled" | "trialing";
};

type PlatformTenantStorageOut = {
  message: string;
  tenant_id: string;
  storage_used_bytes: number;
};

type PlatformTenantDetailOut = {
  tenant: { id: string; nome: string; slug: string; criado_em: string; is_active: boolean };
  admin_users: Array<{ id: string; nome: string; email: string; is_active: boolean }>;
  subscription: {
    plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
    status: "free" | "active" | "past_due" | "expired" | "canceled" | "trialing";
    current_period_end?: string | null;
    grace_period_end?: string | null;
  } | null;
  users_total: number;
  clients_total: number;
  processes_total: number;
  storage_used_bytes: number;
  storage_limit_bytes: number | null;
};

type PlatformAuditLogOut = {
  id: string;
  action: string;
  tenant_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const createSchema = z.object({
  tenant_nome: z.string().min(2),
  tenant_tipo_documento: z.enum(["cpf", "cnpj"]).default("cnpj"),
  tenant_documento: z.string().min(8),
  tenant_slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  admin_nome: z.string().min(2),
  admin_email: z.string().email(),
  // Optional because "primeiro acesso" pode ser via convite (sem senha inicial).
  admin_senha: z.string().optional()
});
type CreateValues = z.infer<typeof createSchema>;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  const decimals = idx === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${units[idx]}`;
}

function statusToLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const value = status.toUpperCase();
  if (value === "ACTIVE") return "ACTIVE";
  if (value === "PAST_DUE") return "PAST_DUE";
  if (value === "EXPIRED") return "EXPIRED";
  return value;
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitsTenant, setLimitsTenant] = useState<PlatformTenantListItem | null>(null);
  const [limitsClients, setLimitsClients] = useState<string>("");
  const [limitsStorage, setLimitsStorage] = useState<string>("");
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "FREE" | "PLUS">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "past_due" | "expired">("all");
  const [storageThreshold, setStorageThreshold] = useState<"all" | "80" | "90">("all");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [platformReady, setPlatformReady] = useState(false);
  const [platformAuthenticated, setPlatformAuthenticated] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<"FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX">("FREE");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"free" | "active" | "past_due" | "expired" | "canceled" | "trialing">("active");

  const overview = useQuery({
    queryKey: ["platform-overview"],
    queryFn: async () => (await api.get<PlatformOverviewOut>("/v1/platform/metrics/overview")).data,
    retry: false,
    enabled: platformReady && platformAuthenticated
  });

  const tenants = useQuery({
    queryKey: ["platform-tenants", { q, planFilter, statusFilter, storageThreshold }],
    queryFn: async () => {
      const params: Record<string, any> = { limit: 100, offset: 0 };
      if (q.trim()) params.search = q.trim();
      if (planFilter !== "all") params.plan = planFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (storageThreshold !== "all") params.storage_gt = Number.parseInt(storageThreshold, 10);
      return (await api.get<PlatformTenantListItem[]>("/v1/platform/tenants", { params })).data;
    },
    retry: false,
    enabled: platformReady && platformAuthenticated
  });

  const selectedTenant = useMemo(
    () => tenants.data?.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants.data]
  );

  const tenantDetail = useQuery({
    queryKey: ["platform-tenant-detail", selectedTenantId],
    queryFn: async () => (await api.get<PlatformTenantDetailOut>(`/v1/platform/tenants/${selectedTenantId}`)).data,
    enabled: !!selectedTenantId && platformAuthenticated,
    retry: false
  });

  const tenantAudit = useQuery({
    queryKey: ["platform-tenant-audit", selectedTenantId],
    queryFn: async () =>
      (await api.get<PlatformAuditLogOut[]>("/v1/platform/audit", { params: { tenant_id: selectedTenantId, limit: 20 } })).data,
    enabled: !!selectedTenantId && platformAuthenticated,
    retry: false
  });

  useEffect(() => {
    const state = getPlatformSessionState();
    setPlatformAuthenticated(state.valid);
    setPlatformReady(true);
    if (!state.valid) {
      router.replace(`/platform/login?reason=${state.reason ?? "missing"}&next=/platform`);
      return;
    }

    const onPlatformAuthFailed = () => {
      setPlatformAuthenticated(false);
      router.replace("/platform/login?reason=unauthorized&next=/platform");
    };
    window.addEventListener("platformAuthFailed", onPlatformAuthFailed);
    return () => window.removeEventListener("platformAuthFailed", onPlatformAuthFailed);
  }, [router]);

  useEffect(() => {
    if (!tenantDetail.data?.subscription) return;
    setSubscriptionPlan(tenantDetail.data.subscription.plan_code);
    setSubscriptionStatus(tenantDetail.data.subscription.status);
  }, [tenantDetail.data]);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      tenant_nome: "",
      tenant_tipo_documento: "cnpj",
      tenant_documento: "",
      tenant_slug: "",
      admin_nome: "",
      admin_email: "",
      admin_senha: ""
    }
  });

  const createTenant = useMutation({
    mutationFn: async (values: CreateValues) => (await api.post<PlatformTenantCreatedOut>("/v1/platform/tenants", values)).data,
    onSuccess: async () => {
      form.reset();
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
      toast("Tenant criado com sucesso.", { variant: "success" });
    }
  });

  const createTrialTenant = useMutation({
    mutationFn: async (values: Omit<CreateValues, "admin_senha">) =>
      (await api.post<PlatformTenantCreatedOut>("/v1/platform/tenants/trial", values)).data,
    onSuccess: async () => {
      form.reset();
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
      toast("Tenant Free criado e convite enviado.", { variant: "success" });
    }
  });

  const resendInvite = useMutation({
    mutationFn: async (tenantId: string) => (await api.post<PlatformResendInviteOut>(`/v1/platform/tenants/${tenantId}/resend-invite`)).data,
    onSuccess: async (data) => {
      setActionInfo(`Convite reenviado para ${data.email}`);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
    }
  });

  const setTenantActive = useMutation({
    mutationFn: async ({ tenantId, active }: { tenantId: string; active: boolean }) => {
      const url = active
        ? `/v1/platform/tenants/${tenantId}/activate`
        : `/v1/platform/tenants/${tenantId}/deactivate`;
      return (await api.post<PlatformTenantStatusOut>(url)).data;
    },
    onSuccess: async (data) => {
      setActionInfo(data.message);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-audit"] });
    }
  });

  const deleteTenant = useMutation({
    mutationFn: async ({ tenantId, confirm }: { tenantId: string; confirm: string }) =>
      (await api.delete<PlatformTenantDeletedOut>(`/v1/platform/tenants/${tenantId}`, { params: { confirm } })).data,
    onSuccess: async (data) => {
      setActionInfo(data.message);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
      setSelectedTenantId(null);
    }
  });

  const updateLimits = useMutation({
    mutationFn: async (vars: { tenantId: string; maxClients: number | null; maxStorageMb: number | null }) =>
      (
        await api.patch<PlatformTenantLimitsOut>(`/v1/platform/tenants/${vars.tenantId}/limits`, {
          max_clients_override: vars.maxClients,
          max_storage_mb_override: vars.maxStorageMb
        })
      ).data,
    onSuccess: async (data) => {
      setActionInfo(
        `Limites atualizados: clientes=${data.max_clients_override ?? "padrão"}; armazenamento=${data.max_storage_mb_override ?? "padrão"} MB`
      );
      setLimitsOpen(false);
      setLimitsTenant(null);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-detail"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-audit"] });
    }
  });

  const updateSubscription = useMutation({
    mutationFn: async (vars: { tenantId: string; planCode: string; status: string }) =>
      (
        await api.patch<PlatformTenantSubscriptionOut>(`/v1/platform/tenants/${vars.tenantId}/subscription`, {
          plan_code: vars.planCode,
          status: vars.status
        })
      ).data,
    onSuccess: async (data) => {
      setActionInfo(`${data.message}: ${data.plan_code} / ${data.status.toUpperCase()}`);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-detail"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-audit"] });
    }
  });

  const recalculateStorage = useMutation({
    mutationFn: async (tenantId: string) =>
      (await api.post<PlatformTenantStorageOut>(`/v1/platform/tenants/${tenantId}/recalculate-storage`)).data,
    onSuccess: async (data) => {
      setActionInfo(`${data.message}: ${formatBytes(data.storage_used_bytes)}`);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      await qc.invalidateQueries({ queryKey: ["platform-overview"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-detail"] });
      await qc.invalidateQueries({ queryKey: ["platform-tenant-audit"] });
    }
  });

  function openLimitsModal(t: PlatformTenantListItem) {
    setLimitsError(null);
    setLimitsTenant(t);
    setLimitsClients(t.max_clients_override == null ? "" : String(t.max_clients_override));
    setLimitsStorage(t.max_storage_mb_override == null ? "" : String(t.max_storage_mb_override));
    setLimitsOpen(true);
  }

  function parseNullableInt(raw: string): number | null {
    const v = raw.trim();
    if (!v) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  function saveLimits() {
    if (!limitsTenant) return;

    const maxClients = parseNullableInt(limitsClients);
    const maxStorageMb = parseNullableInt(limitsStorage);

    if (maxClients !== null && maxClients < 1) {
      setLimitsError("Informe um limite de clientes >= 1 (ou deixe vazio para usar o padrão do plano).");
      return;
    }
    if (maxStorageMb !== null && maxStorageMb < 10) {
      setLimitsError("Informe um limite de armazenamento >= 10 MB (ou deixe vazio para usar o padrão do plano).");
      return;
    }

    if (!window.confirm("Confirmar atualização dos limites deste tenant?")) return;
    updateLimits.mutate({ tenantId: limitsTenant.id, maxClients, maxStorageMb });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      {!platformReady ? <p className="text-sm text-muted-foreground">Verificando sessão da plataforma...</p> : null}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Admin da Plataforma (Super-admin)</CardTitle>
            <CardDescription>Área de gestão e segurança dos tenants do SaaS.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                lockPlatformAdminSession();
                router.replace("/platform/login?reason=locked&next=/platform");
              }}
            >
              Travar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                clearPlatformAdminSession();
                router.replace("/platform/login");
              }}
            >
              Sair
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visão geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {overview.isLoading ? <p className="text-sm text-muted-foreground">Carregando métricas...</p> : null}
          {overview.data ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Tenants totais</p>
                    <p className="text-2xl font-semibold">{overview.data.tenants_total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Usuários totais</p>
                    <p className="text-2xl font-semibold">{overview.data.users_total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Tenants Free</p>
                    <p className="text-2xl font-semibold">{overview.data.tenants_free}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Tenants Plus</p>
                    <p className="text-2xl font-semibold">{overview.data.tenants_plus}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Storage total</p>
                    <p className="text-2xl font-semibold">{formatBytes(overview.data.storage_used_bytes_total)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top 5 por storage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {overview.data.top_storage_tenants.map((item) => (
                      <p key={item.tenant_id}>
                        {item.tenant_nome} ({item.tenant_slug}) - {formatBytes(item.value)}
                      </p>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top 5 por volume</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {overview.data.top_volume_tenants.map((item) => (
                      <p key={item.tenant_id}>
                        {item.tenant_nome} ({item.tenant_slug}) - {item.value}
                      </p>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Últimos 10 tenants</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {overview.data.recent_tenants.map((item) => (
                      <p key={item.tenant_id}>
                        {item.tenant_nome} ({item.tenant_slug}) - {formatDateTimeBR(item.created_at)}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {limitsOpen && limitsTenant ? (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => {
              if (updateLimits.isPending) return;
              setLimitsOpen(false);
              setLimitsTenant(null);
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            className={[
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[95vw] max-w-xl",
              "max-h-[85vh] overflow-hidden",
              "rounded-2xl border border-border/20 bg-background/95 shadow-xl backdrop-blur"
            ].join(" ")}
          >
            <div className="flex max-h-[85vh] flex-col">
              <header className="border-b border-border/10 bg-background/95 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Limites do tenant</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste limites personalizados (somente via chave de admin). Deixe vazio para usar o padrão do plano.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-mono">{limitsTenant.slug}</span> • {limitsTenant.nome}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      if (updateLimits.isPending) return;
                      setLimitsOpen(false);
                      setLimitsTenant(null);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {limitsError ? <p className="mb-3 text-sm text-destructive">{limitsError}</p> : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Limite de clientes (override)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Ex: 3"
                      value={limitsClients}
                      onChange={(e) => setLimitsClients(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Ex.: 3 no Free. Vazio = padrão do plano.</p>
                  </div>

                  <div className="space-y-1">
                    <Label>Armazenamento (MB override)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Ex: 100"
                      value={limitsStorage}
                      onChange={(e) => setLimitsStorage(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Vazio = padrão do plano.</p>
                  </div>
                </div>
              </div>

              <footer className="border-t border-border/10 bg-background/95 p-4 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={updateLimits.isPending}
                    onClick={() => {
                      setLimitsOpen(false);
                      setLimitsTenant(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" disabled={updateLimits.isPending} onClick={saveLimits}>
                    {updateLimits.isPending ? "Salvando..." : "Salvar limites"}
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Criar Escritório (Tenant) + Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="space-y-1 md:col-span-3">
              <Label>Nome do escritório</Label>
              <Input {...form.register("tenant_nome")} placeholder="Ex: Silva & Associados" />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>Tipo</Label>
              <Select {...form.register("tenant_tipo_documento")}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Documento</Label>
              <Input {...form.register("tenant_documento")} placeholder="CPF ou CNPJ" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Slug</Label>
              <Input {...form.register("tenant_slug")} placeholder="ex: silva" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Admin (nome)</Label>
              <Input {...form.register("admin_nome")} placeholder="Ex: Dra. Ana" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Admin (email)</Label>
              <Input type="email" {...form.register("admin_email")} placeholder="ana@escritorio.com.br" />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Admin (senha inicial)</Label>
              <Input type="password" {...form.register("admin_senha")} placeholder="mín. 8 caracteres" />
              <p className="text-xs text-muted-foreground">
                Para teste (Free), você pode criar “sem senha” e enviar link de primeiro acesso por e-mail.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2 md:col-span-3">
              <Button
                disabled={createTenant.isPending}
                type="button"
                onClick={form.handleSubmit((v) => {
                  const senha = (v.admin_senha ?? "").trim();
                  if (senha.length < 8) {
                    form.setError("admin_senha", { message: "Informe uma senha com pelo menos 8 caracteres." });
                    return;
                  }
                  createTenant.mutate({ ...v, admin_senha: senha });
                })}
              >
                {createTenant.isPending ? "Criando..." : "Criar (com senha)"}
              </Button>

              <Button
                variant="secondary"
                disabled={createTrialTenant.isPending}
                type="button"
                onClick={form.handleSubmit((v) => {
                  const { admin_senha: _ignored, ...rest } = v;
                  createTrialTenant.mutate(rest);
                })}
              >
                {createTrialTenant.isPending ? "Enviando..." : "Criar Free + enviar convite"}
              </Button>
            </div>
          </form>

          {createTenant.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(createTenant.error as any)?.response?.data?.detail ?? "Erro ao criar tenant"}
            </p>
          ) : null}

          {createTenant.data ? (
            <div className="mt-4 rounded-md border border-border/20 bg-card/40 p-3 text-sm">
              <div className="font-medium text-foreground">Tenant criado</div>
              <div className="mt-1 text-muted-foreground">
                Slug: <span className="font-mono">{createTenant.data.tenant.slug}</span>
              </div>
              <div className="text-muted-foreground">
                Admin: <span className="font-mono">{createTenant.data.admin_user.email}</span>
              </div>
              <div className="mt-2">
                <Link className="underline" href="/login">
                  Ir para login
                </Link>
                <span className="text-xs text-muted-foreground"> (use o email e a senha inicial)</span>
              </div>
            </div>
          ) : null}

          {createTrialTenant.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(createTrialTenant.error as any)?.response?.data?.detail ?? "Erro ao criar Free e enviar convite"}
            </p>
          ) : null}

          {createTrialTenant.data ? (
            <div className="mt-4 rounded-md border border-border/20 bg-card/40 p-3 text-sm">
              <div className="font-medium text-foreground">Tenant Free criado</div>
              <div className="mt-1 text-muted-foreground">
                Slug: <span className="font-mono">{createTrialTenant.data.tenant.slug}</span>
              </div>
              <div className="text-muted-foreground">
                Email do admin: <span className="font-mono">{createTrialTenant.data.admin_user.email}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Se o SMTP estiver configurado, enviamos um link de primeiro acesso para definir senha em `/accept-invite`.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {actionInfo ? <p className="mt-2 text-sm text-emerald-600">{actionInfo}</p> : null}
          {resendInvite.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {(resendInvite.error as any)?.response?.data?.detail ?? "Erro ao reenviar convite"}
            </p>
          ) : null}
          {setTenantActive.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {(setTenantActive.error as any)?.response?.data?.detail ?? "Erro ao alterar status do tenant"}
            </p>
          ) : null}
          {deleteTenant.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {(deleteTenant.error as any)?.response?.data?.detail ?? "Erro ao excluir tenant"}
            </p>
          ) : null}
          {tenants.data ? (
            <div className="mt-3 overflow-x-auto">
              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Busca</Label>
                  <Input placeholder="Nome, slug ou e-mail admin" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Plano</Label>
                  <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as any)}>
                    <option value="all">Todos</option>
                    <option value="FREE">Free</option>
                    <option value="PLUS">Plus</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status assinatura</Label>
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                    <option value="all">Todos</option>
                    <option value="active">ACTIVE</option>
                    <option value="past_due">PAST_DUE</option>
                    <option value="expired">EXPIRED</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Storage</Label>
                  <Select value={storageThreshold} onChange={(e) => setStorageThreshold(e.target.value as any)}>
                    <option value="all">Todos</option>
                    <option value="80">{">= 80%"}</option>
                    <option value="90">{">= 90%"}</option>
                  </Select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escritório</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{t.nome}</span>
                          <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>
                          <span className="font-mono text-xs text-muted-foreground">{t.admin_email ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{t.plan_nome ?? t.plan_code ?? "—"}</span>
                          {t.plan_code ? <span className="font-mono text-xs text-muted-foreground">{t.plan_code}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{statusToLabel(t.subscription_status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatBytes(t.storage_used_bytes)} / {t.storage_limit_bytes ? formatBytes(t.storage_limit_bytes) : "—"}
                        <br />
                        <span className="text-muted-foreground">{t.storage_percent_used != null ? `${t.storage_percent_used}%` : "—"}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.users_active}/{t.users_total}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.clients_total}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDateTimeBR(t.criado_em)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" type="button" onClick={() => setSelectedTenantId(t.id)}>
                            Detalhe
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={() => resendInvite.mutate(t.id)}
                          >
                            {resendInvite.isPending ? "Enviando..." : "Reenviar convite"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => openLimitsModal(t)}
                          >
                            Limites
                          </Button>
                          <Button
                            size="sm"
                            variant={t.is_active ? "outline" : "secondary"}
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Confirmar ${t.is_active ? "desativação" : "ativação"} do tenant ${t.slug}?`)) return;
                              setTenantActive.mutate({ tenantId: t.id, active: !t.is_active });
                            }}
                          >
                            {setTenantActive.isPending ? "Salvando..." : t.is_active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={t.is_active || deleteTenant.isPending}
                            type="button"
                            onClick={() => {
                              const typed = window.prompt(
                                `Para EXCLUIR este tenant, digite o slug exatamente como aparece:\n\n${t.slug}\n\n(ação irreversível)`
                              );
                              if (!typed) return;
                              if (typed.trim() !== t.slug) {
                                window.alert("Slug não confere. Exclusão cancelada.");
                                return;
                              }
                              deleteTenant.mutate({ tenantId: t.id, confirm: typed.trim() });
                            }}
                          >
                            Excluir
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/${t.slug}`}>Dashboard</Link>
                          </Button>
                        </div>
                        {t.is_active ? <p className="mt-1 text-xs text-muted-foreground">Para excluir, desative primeiro.</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {tenants.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {(tenants.error as any)?.response?.data?.detail ??
                (tenants.error as any)?.message ??
                "Erro ao carregar tenants (confira a chave e o backend)"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selectedTenantId ? (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" onClick={() => setSelectedTenantId(null)} />
          <div className="fixed left-1/2 top-1/2 h-[88vh] w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/20 bg-background/95 shadow-xl backdrop-blur">
            <div className="flex h-full flex-col">
              <header className="border-b border-border/10 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Detalhe do tenant</h2>
                    {selectedTenant ? <p className="text-sm text-muted-foreground">{selectedTenant.nome} ({selectedTenant.slug})</p> : null}
                  </div>
                  <Button variant="outline" onClick={() => setSelectedTenantId(null)} type="button">
                    Fechar
                  </Button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {tenantDetail.isLoading ? <p className="text-sm text-muted-foreground">Carregando detalhes...</p> : null}
                {tenantDetail.data ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Usuários</p>
                          <p className="text-xl font-semibold">{tenantDetail.data.users_total}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Clientes</p>
                          <p className="text-xl font-semibold">{tenantDetail.data.clients_total}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Processos</p>
                          <p className="text-xl font-semibold">{tenantDetail.data.processes_total}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground">Storage</p>
                          <p className="text-xl font-semibold">{formatBytes(tenantDetail.data.storage_used_bytes)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Ações administrativas</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Plano</Label>
                          <Select value={subscriptionPlan} onChange={(e) => setSubscriptionPlan(e.target.value as any)}>
                            <option value="FREE">Free</option>
                            <option value="PLUS_MONTHLY_CARD">Plus mensal</option>
                            <option value="PLUS_ANNUAL_PIX">Plus anual</option>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Status assinatura</Label>
                          <Select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value as any)}>
                            <option value="active">ACTIVE</option>
                            <option value="past_due">PAST_DUE</option>
                            <option value="expired">EXPIRED</option>
                            <option value="free">FREE</option>
                            <option value="canceled">CANCELED</option>
                            <option value="trialing">TRIALING</option>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            type="button"
                            disabled={updateSubscription.isPending}
                            onClick={() => {
                              if (!selectedTenant) return;
                              if (!window.confirm("Confirmar atualização de plano/status deste tenant?")) return;
                              updateSubscription.mutate({
                                tenantId: selectedTenant.id,
                                planCode: subscriptionPlan,
                                status: subscriptionStatus
                              });
                            }}
                          >
                            {updateSubscription.isPending ? "Salvando..." : "Definir plano/status"}
                          </Button>
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            variant="outline"
                            type="button"
                            disabled={recalculateStorage.isPending}
                            onClick={() => {
                              if (!selectedTenant) return;
                              if (!window.confirm("Recalcular consumo de storage agora?")) return;
                              recalculateStorage.mutate(selectedTenant.id);
                            }}
                          >
                            {recalculateStorage.isPending ? "Calculando..." : "Recalcular storage"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Modo suporte</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                        <Button
                          variant="outline"
                          type="button"
                          onClick={async () => {
                            if (!selectedTenant) return;
                            await navigator.clipboard.writeText(selectedTenant.id);
                            toast("Tenant ID copiado.", { variant: "success" });
                          }}
                        >
                          Copiar Tenant ID
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={async () => {
                            if (!selectedTenant) return;
                            await navigator.clipboard.writeText(selectedTenant.slug);
                            toast("Slug copiado.", { variant: "success" });
                          }}
                        >
                          Copiar Slug
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={async () => {
                            if (!selectedTenant?.admin_email) return;
                            await navigator.clipboard.writeText(selectedTenant.admin_email);
                            toast("E-mail do admin copiado.", { variant: "success" });
                          }}
                        >
                          Copiar e-mail admin
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={async () => {
                            if (!selectedTenant) return;
                            const billingLink = `${window.location.origin}/billing?tenant=${selectedTenant.slug}`;
                            await navigator.clipboard.writeText(billingLink);
                            toast("Link de billing copiado.", { variant: "success" });
                          }}
                        >
                          Copiar link billing
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Auditoria da plataforma</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {tenantAudit.isLoading ? <p className="text-muted-foreground">Carregando logs...</p> : null}
                        {tenantAudit.data?.length ? (
                          tenantAudit.data.map((log) => (
                            <div key={log.id} className="rounded-lg border border-border/20 px-3 py-2">
                              <p className="font-mono text-xs text-muted-foreground">{formatDateTimeBR(log.created_at)}</p>
                              <p className="font-medium">{log.action}</p>
                              <p className="text-xs text-muted-foreground">{log.payload ? JSON.stringify(log.payload) : "Sem payload"}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground">Sem logs para este tenant.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
