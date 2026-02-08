"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { api } from "@/lib/api";
import { getAccessToken, setTokens, type TokenPair } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

const resetSchema = z.object({
  email: z.string().email()
});
type ResetValues = z.infer<typeof resetSchema>;

function normalizeSlug(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove accents
  return s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function onlyDigits(input: string): string {
  return input.replace(/\D+/g, "");
}

const registerSchema = z
  .object({
    tenant_nome: z.string().min(2, "Informe o nome do escritório"),
    tenant_tipo_documento: z.enum(["cpf", "cnpj"]).default("cnpj"),
    tenant_documento: z.string().min(8, "Informe o CPF/CNPJ"),
    tenant_slug: z
      .string()
      .min(2, "Informe um slug (ex: silva-advocacia)")
      .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
    admin_nome: z.string().min(2, "Informe seu nome"),
    admin_email: z.string().email("Email inválido"),
    admin_senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
    admin_senha_confirm: z.string().min(8, "Confirme a senha")
  })
  .refine((d) => d.admin_senha === d.admin_senha_confirm, {
    path: ["admin_senha_confirm"],
    message: "As senhas não conferem"
  });
type RegisterValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const router = useRouter();
  const initializedFromQuery = useRef(false);
  const [showReset, setShowReset] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
  const [registerSlugEdited, setRegisterSlugEdited] = useState(false);

  useEffect(() => {
    if (initializedFromQuery.current) return;
    initializedFromQuery.current = true;

    const mode = new URLSearchParams(window.location.search).get("mode");
    if (mode === "register") {
      setShowRegister(true);
      setShowReset(false);
    } else if (mode === "reset") {
      setShowReset(true);
      setShowRegister(false);
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      // best-effort redirect if already logged in
      api
        .get<{ slug: string }>("/v1/tenants/me")
        .then((r) => router.replace(`/dashboard/${r.data.slug}`))
        .catch(() => {
          // ignore
        });
    }
  }, [router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", senha: "" }
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" }
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenant_nome: "",
      tenant_tipo_documento: "cnpj",
      tenant_documento: "",
      tenant_slug: "",
      admin_nome: "",
      admin_email: "",
      admin_senha: "",
      admin_senha_confirm: ""
    }
  });

  const watchedTenantNome = registerForm.watch("tenant_nome");
  useEffect(() => {
    if (registerSlugEdited) return;
    if (!watchedTenantNome?.trim()) {
      registerForm.setValue("tenant_slug", "", { shouldDirty: false, shouldValidate: true });
      return;
    }
    registerForm.setValue("tenant_slug", normalizeSlug(watchedTenantNome), { shouldDirty: false, shouldValidate: true });
  }, [registerSlugEdited, registerForm, watchedTenantNome]);

  const login = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = new URLSearchParams();
      body.set("username", values.email);
      body.set("password", values.senha);
      // OAuth2PasswordRequestForm requires this field sometimes
      body.set("grant_type", "password");

      const r = await api.post<TokenPair>("/v1/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      setTokens(r.data);

      const t = await api.get<{ slug: string }>("/v1/tenants/me");
      router.replace(`/dashboard/${t.data.slug}`);
    }
  });

  const reset = useMutation({
    mutationFn: async (values: ResetValues) => {
      await api.post("/v1/auth/reset-password", { email: values.email });
    },
    onSuccess: async () => {
      resetForm.reset({ email: "" });
    }
  });

  const registerTenant = useMutation({
    mutationFn: async (values: RegisterValues) => {
      const payload = {
        tenant_nome: values.tenant_nome,
        tenant_tipo_documento: values.tenant_tipo_documento,
        tenant_documento: onlyDigits(values.tenant_documento),
        tenant_slug: normalizeSlug(values.tenant_slug),
        admin_nome: values.admin_nome,
        admin_email: values.admin_email,
        admin_senha: values.admin_senha
      };

      const r = await api.post<TokenPair>("/v1/auth/register-tenant", payload);
      setTokens(r.data);

      const t = await api.get<{ slug: string }>("/v1/tenants/me");
      router.replace(`/dashboard/${t.data.slug}`);
    }
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Seu escritório seguro em qualquer lugar</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => login.mutate(v))}>
            <div className="space-y-1">
              <Label htmlFor="login_email">Email</Label>
              <Input id="login_email" autoComplete="email" type="email" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="login_senha">Senha</Label>
              <div className="relative">
                <Input
                  id="login_senha"
                  autoComplete="current-password"
                  type={showLoginPassword ? "text" : "password"}
                  className="pr-10"
                  {...form.register("senha")}
                />
                <Button
                  aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => setShowLoginPassword((v) => !v)}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {form.formState.errors.senha?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.senha.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={login.isPending} type="submit">
              {login.isPending ? "Entrando..." : "Entrar"}
            </Button>

            {login.isError ? (
              <p className="text-sm text-red-600">
                {(login.error as any)?.response?.data?.detail ?? "Falha no login"}
              </p>
            ) : null}
          </form>

          <div className="mt-4 border-t pt-4">
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={() => {
                setShowReset((v) => !v);
                setShowRegister(false);
              }}
            >
              {showReset ? "Fechar" : "Esqueci minha senha"}
            </Button>

            {showReset ? (
              <form className="mt-3 space-y-2" onSubmit={resetForm.handleSubmit((v) => reset.mutate(v))}>
                <div className="space-y-1">
                  <Label>Email para redefinição</Label>
                  <Input type="email" placeholder="seuemail@dominio.com" {...resetForm.register("email")} />
                  {resetForm.formState.errors.email?.message ? (
                    <p className="text-xs text-red-600">{resetForm.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <Button className="w-full" disabled={reset.isPending} type="submit">
                  {reset.isPending ? "Enviando..." : "Enviar link de redefinição"}
                </Button>

                {reset.isSuccess ? (
                  <p className="text-sm text-emerald-700">
                    Se o email existir, enviaremos um link de redefinição.
                  </p>
                ) : null}
                {reset.isError ? (
                  <p className="text-sm text-red-600">
                    {(reset.error as any)?.response?.data?.detail ?? "Erro ao solicitar redefinição"}
                  </p>
                ) : null}
              </form>
            ) : null}

            <Button
              className="mt-2 w-full"
              type="button"
              variant="outline"
              onClick={() => {
                setShowRegister((v) => !v);
                setShowReset(false);
              }}
            >
              {showRegister ? "Fechar cadastro" : "Criar conta grátis"}
            </Button>

            {showRegister ? (
              <form className="mt-3 space-y-2" onSubmit={registerForm.handleSubmit((v) => registerTenant.mutate(v))}>
                <div className="space-y-1">
                  <Label htmlFor="reg_tenant_nome">Nome do escritório</Label>
                  <Input id="reg_tenant_nome" placeholder="Ex: Silva Advocacia" {...registerForm.register("tenant_nome")} />
                  {registerForm.formState.errors.tenant_nome?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.tenant_nome.message}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-1">
                    <Label htmlFor="reg_tipo_doc">Tipo</Label>
                    <Select id="reg_tipo_doc" {...registerForm.register("tenant_tipo_documento")}>
                      <option value="cnpj">CNPJ</option>
                      <option value="cpf">CPF</option>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="reg_documento">CPF/CNPJ</Label>
                    <Input
                      id="reg_documento"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Somente números"
                      {...registerForm.register("tenant_documento", {
                        onChange: (e) => {
                          registerForm.setValue("tenant_documento", onlyDigits(e.target.value), {
                            shouldValidate: true
                          });
                        }
                      })}
                    />
                    <p className="text-xs text-zinc-600">
                      Se não tiver CNPJ, selecione CPF e use o CPF do responsável.
                    </p>
                    {registerForm.formState.errors.tenant_documento?.message ? (
                      <p className="text-xs text-red-600">{registerForm.formState.errors.tenant_documento.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg_slug">Slug do escritório</Label>
                  <Input
                    id="reg_slug"
                    placeholder="ex: silva-advocacia"
                    {...registerForm.register("tenant_slug", {
                      onChange: () => setRegisterSlugEdited(true)
                    })}
                  />
                  {registerForm.formState.errors.tenant_slug?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.tenant_slug.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg_admin_nome">Seu nome</Label>
                  <Input id="reg_admin_nome" placeholder="Ex: João Souza" {...registerForm.register("admin_nome")} />
                  {registerForm.formState.errors.admin_nome?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.admin_nome.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg_admin_email">Seu email</Label>
                  <Input
                    id="reg_admin_email"
                    autoComplete="email"
                    type="email"
                    placeholder="seuemail@dominio.com"
                    {...registerForm.register("admin_email")}
                  />
                  {registerForm.formState.errors.admin_email?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.admin_email.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg_admin_senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="reg_admin_senha"
                      autoComplete="new-password"
                      type={showRegisterPassword ? "text" : "password"}
                      className="pr-10"
                      {...registerForm.register("admin_senha")}
                    />
                    <Button
                      aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => setShowRegisterPassword((v) => !v)}
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {registerForm.formState.errors.admin_senha?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.admin_senha.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg_admin_senha_confirm">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="reg_admin_senha_confirm"
                      autoComplete="new-password"
                      type={showRegisterPasswordConfirm ? "text" : "password"}
                      className="pr-10"
                      {...registerForm.register("admin_senha_confirm")}
                    />
                    <Button
                      aria-label={showRegisterPasswordConfirm ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => setShowRegisterPasswordConfirm((v) => !v)}
                    >
                      {showRegisterPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {registerForm.formState.errors.admin_senha_confirm?.message ? (
                    <p className="text-xs text-red-600">{registerForm.formState.errors.admin_senha_confirm.message}</p>
                  ) : null}
                </div>

                <Button className="w-full" disabled={registerTenant.isPending} type="submit">
                  {registerTenant.isPending ? "Criando..." : "Criar conta"}
                </Button>

                {registerTenant.isError ? (
                  <p className="text-sm text-red-600">
                    {(registerTenant.error as any)?.response?.data?.detail ?? "Erro ao criar conta"}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
