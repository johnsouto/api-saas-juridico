"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
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
  plan_nome?: string | null;
  subscription_status?: string | null;
  subscription_ativo?: boolean | null;
  subscription_validade?: string | null;
};

type PlatformTenantCreatedOut = {
  tenant: { id: string; nome: string; cnpj?: string | null; slug: string; criado_em: string };
  admin_user: { id: string; nome: string; email: string; role: string };
  tokens: { access_token: string; refresh_token: string };
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

export default function PlatformAdminPage() {
  const qc = useQueryClient();
  const [keyInput, setKeyInput] = useState("");
  const storedKey = useMemo(() => getPlatformAdminKey(), []);

  const tenants = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => (await api.get<PlatformTenantListItem[]>("/v1/platform/tenants")).data,
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
          {tenants.data ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Doc</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acessar</TableHead>
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
                      <TableCell>{t.plan_nome ?? "—"}</TableCell>
                      <TableCell>{t.subscription_status ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/${t.slug}`}>Dashboard</Link>
                        </Button>
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
