"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/datetime";
import { clearPlatformAdminKey, getPlatformAdminKey, setPlatformAdminKey } from "@/lib/platformAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  storage_used_bytes: number;

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

export default function PlatformAdminPage() {
  const qc = useQueryClient();
  const [keyInput, setKeyInput] = useState("");
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const storedKey = useMemo(() => getPlatformAdminKey(), []);

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitsTenant, setLimitsTenant] = useState<PlatformTenantListItem | null>(null);
  const [limitsClients, setLimitsClients] = useState<string>("");
  const [limitsStorage, setLimitsStorage] = useState<string>("");
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [documento, setDocumento] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [ativo, setAtivo] = useState<"all" | "active" | "inactive">("all");

  const tenants = useQuery({
    queryKey: ["platform-tenants", { q, documento, adminEmail, ativo }],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (q.trim()) params.q = q.trim();
      if (documento.trim()) params.documento = documento.trim();
      if (adminEmail.trim()) params.admin_email = adminEmail.trim();
      if (ativo !== "all") params.is_active = ativo === "active";
      return (await api.get<PlatformTenantListItem[]>("/v1/platform/tenants", { params })).data;
    },
    enabled: !!storedKey,
    retry: false
  });

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
    }
  });

  const createTrialTenant = useMutation({
    mutationFn: async (values: Omit<CreateValues, "admin_senha">) =>
      (await api.post<PlatformTenantCreatedOut>("/v1/platform/tenants/trial", values)).data,
    onSuccess: async () => {
      form.reset();
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    }
  });

  const resendInvite = useMutation({
    mutationFn: async (tenantId: string) => (await api.post<PlatformResendInviteOut>(`/v1/platform/tenants/${tenantId}/resend-invite`)).data,
    onSuccess: async (data) => {
      setActionInfo(`Convite reenviado para ${data.email}`);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
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
    }
  });

  const deleteTenant = useMutation({
    mutationFn: async ({ tenantId, confirm }: { tenantId: string; confirm: string }) =>
      (await api.delete<PlatformTenantDeletedOut>(`/v1/platform/tenants/${tenantId}`, { params: { confirm } })).data,
    onSuccess: async (data) => {
      setActionInfo(data.message);
      await qc.invalidateQueries({ queryKey: ["platform-tenants"] });
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

    updateLimits.mutate({ tenantId: limitsTenant.id, maxClients, maxStorageMb });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin da Plataforma (Super-admin)</CardTitle>
          <CardDescription>Provisionamento de escritórios (tenants). Esta área deve ser usada apenas pelo operador do SaaS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-3">
              <Label>PLATFORM_ADMIN_KEY</Label>
              <Input
                placeholder="Cole aqui a chave do super-admin"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dica: defina `PLATFORM_ADMIN_KEY` no `.env` (raiz) para habilitar os endpoints `/v1/platform/*`.
                Em dev, se você não definir, a chave padrão é `dev-platform-key`.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setPlatformAdminKey(keyInput.trim());
                  window.location.reload();
                }}
                disabled={!keyInput.trim()}
              >
                Salvar chave
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  clearPlatformAdminKey();
                  window.location.reload();
                }}
              >
                Limpar
              </Button>
            </div>
          </div>

          {storedKey ? (
            <p className="text-sm text-emerald-600">Chave carregada. Você pode provisionar tenants.</p>
          ) : (
            <p className="text-sm text-amber-500">Informe a chave para habilitar a tela.</p>
          )}
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
                disabled={!storedKey || createTenant.isPending}
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
                disabled={!storedKey || createTrialTenant.isPending}
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
          {!storedKey ? <p className="text-sm text-muted-foreground">Informe a chave para carregar a lista.</p> : null}
          {tenants.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
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
                  <Label>Busca geral</Label>
                  <Input
                    placeholder="Nome, slug, documento ou email"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Documento (CPF/CNPJ)</Label>
                  <Input placeholder="Ex: 12345678900" value={documento} onChange={(e) => setDocumento(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email (admin)</Label>
                  <Input placeholder="Ex: admin@dominio.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Ativo</Label>
                  <Select value={ativo} onChange={(e) => setAtivo(e.target.value as any)}>
                    <option value="all">Todos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </Select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Doc</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Armazenamento</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Datas</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.data.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.tipo_documento}:{t.documento}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.admin_email ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.users_active}/{t.users_total}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatBytes(t.storage_used_bytes)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{t.plan_nome ?? t.plan_code ?? "—"}</span>
                          {t.plan_code ? <span className="font-mono text-xs text-muted-foreground">{t.plan_code}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span>{t.subscription_status ?? "—"}</span>
                          <span className="text-muted-foreground">{t.provider ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span>Vence: {formatDateTimeBR(t.current_period_end)}</span>
                          <span className="text-muted-foreground">Carência: {formatDateTimeBR(t.grace_period_end)}</span>
                        </div>
                      </TableCell>
                      <TableCell className={t.is_active ? "text-emerald-600" : "text-destructive"}>{t.is_active ? "ativo" : "inativo"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!storedKey || resendInvite.isPending}
                            type="button"
                            onClick={() => resendInvite.mutate(t.id)}
                          >
                            {resendInvite.isPending ? "Enviando..." : "Reenviar convite"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!storedKey || updateLimits.isPending}
                            type="button"
                            onClick={() => openLimitsModal(t)}
                          >
                            Limites
                          </Button>
                          <Button
                            size="sm"
                            variant={t.is_active ? "outline" : "secondary"}
                            disabled={!storedKey || setTenantActive.isPending}
                            type="button"
                            onClick={() => setTenantActive.mutate({ tenantId: t.id, active: !t.is_active })}
                          >
                            {setTenantActive.isPending ? "Salvando..." : t.is_active ? "Desativar" : "Ativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!storedKey || t.is_active || deleteTenant.isPending}
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
              {(tenants.error as any)?.response?.data?.detail ?? "Erro ao carregar tenants (confira a chave e o backend)"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
