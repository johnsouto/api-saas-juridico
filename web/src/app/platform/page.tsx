"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/format";
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
              <p className="text-xs text-zinc-600">
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
            <p className="text-sm text-emerald-700">Chave carregada. Você pode provisionar tenants.</p>
          ) : (
            <p className="text-sm text-amber-700">Informe a chave para habilitar a tela.</p>
          )}
        </CardContent>
      </Card>

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
              <p className="text-xs text-zinc-600">
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
            <p className="mt-3 text-sm text-red-600">{(createTenant.error as any)?.response?.data?.detail ?? "Erro ao criar tenant"}</p>
          ) : null}

          {createTenant.data ? (
            <div className="mt-4 rounded-md border bg-white p-3 text-sm">
              <div className="font-medium">Tenant criado</div>
              <div className="mt-1 text-zinc-700">
                Slug: <span className="font-mono">{createTenant.data.tenant.slug}</span>
              </div>
              <div className="text-zinc-700">
                Admin: <span className="font-mono">{createTenant.data.admin_user.email}</span>
              </div>
              <div className="mt-2">
                <Link className="underline" href="/login">
                  Ir para login
                </Link>
                <span className="text-xs text-zinc-600"> (use o email e a senha inicial)</span>
              </div>
            </div>
          ) : null}

          {createTrialTenant.isError ? (
            <p className="mt-3 text-sm text-red-600">
              {(createTrialTenant.error as any)?.response?.data?.detail ?? "Erro ao criar Free e enviar convite"}
            </p>
          ) : null}

          {createTrialTenant.data ? (
            <div className="mt-4 rounded-md border bg-white p-3 text-sm">
              <div className="font-medium">Tenant Free criado</div>
              <div className="mt-1 text-zinc-700">
                Slug: <span className="font-mono">{createTrialTenant.data.tenant.slug}</span>
              </div>
              <div className="text-zinc-700">
                Email do admin: <span className="font-mono">{createTrialTenant.data.admin_user.email}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600">
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
          {!storedKey ? <p className="text-sm text-zinc-600">Informe a chave para carregar a lista.</p> : null}
          {tenants.isLoading ? <p className="text-sm text-zinc-600">Carregando…</p> : null}
          {actionInfo ? <p className="mt-2 text-sm text-emerald-700">{actionInfo}</p> : null}
          {resendInvite.isError ? (
            <p className="mt-2 text-sm text-red-600">
              {(resendInvite.error as any)?.response?.data?.detail ?? "Erro ao reenviar convite"}
            </p>
          ) : null}
          {setTenantActive.isError ? (
            <p className="mt-2 text-sm text-red-600">
              {(setTenantActive.error as any)?.response?.data?.detail ?? "Erro ao alterar status do tenant"}
            </p>
          ) : null}
          {deleteTenant.isError ? (
            <p className="mt-2 text-sm text-red-600">
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
                          {t.plan_code ? <span className="font-mono text-xs text-zinc-500">{t.plan_code}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span>{t.subscription_status ?? "—"}</span>
                          <span className="text-zinc-500">{t.provider ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col">
                          <span>Vence: {formatDateTimeBR(t.current_period_end) || "—"}</span>
                          <span className="text-zinc-500">Carência: {formatDateTimeBR(t.grace_period_end) || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className={t.is_active ? "text-emerald-700" : "text-red-700"}>{t.is_active ? "ativo" : "inativo"}</TableCell>
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
                        {t.is_active ? <p className="mt-1 text-xs text-zinc-500">Para excluir, desative primeiro.</p> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {tenants.isError ? (
            <p className="mt-2 text-sm text-red-600">
              {(tenants.error as any)?.response?.data?.detail ?? "Erro ao carregar tenants (confira a chave e o backend)"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
