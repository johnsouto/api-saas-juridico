"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { api } from "@/lib/api";
import { cleanupLegacySaaSTokens, loginWithEmailSenha, registerTenant as registerTenantApi } from "@/lib/auth";
import { passwordPolicyMessage, validatePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Turnstile } from "@/components/auth/Turnstile";

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

const passwordSchema = z
  .string()
  .min(8, passwordPolicyMessage)
  .refine((pwd) => validatePassword(pwd).allOk, passwordPolicyMessage);

const registerSchema = z
  .object({
    tenant_nome: z.string().min(2, "Informe o nome do escritório"),
    tenant_tipo_documento: z.enum(["cpf", "cnpj"]).default("cnpj"),
    tenant_documento: z.string().min(8, "Informe o CPF/CNPJ"),
    tenant_slug: z
      .string()
      .min(2, "Informe um slug (ex: silva-advocacia)")
      .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
    first_name: z.string().min(2, "Informe seu primeiro nome"),
    last_name: z.string().min(2, "Informe seu sobrenome"),
    admin_email: z.string().email("Email inválido"),
    admin_senha: passwordSchema,
    admin_senha_confirm: z.string().min(8, "Confirme a senha")
  })
  .refine((d) => d.admin_senha === d.admin_senha_confirm, {
    path: ["admin_senha_confirm"],
    message: "As senhas não conferem"
  });
type RegisterValues = z.infer<typeof registerSchema>;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function LoginPage() {
  const router = useRouter();
  const initializedFromQuery = useRef(false);
  const [showReset, setShowReset] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [nextPath, setNextPath] = useState("/dashboard");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasswordConfirm, setShowRegisterPasswordConfirm] = useState(false);
  const [registerSlugEdited, setRegisterSlugEdited] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

  function safeNext(raw: string | null): string {
    if (!raw) return "/dashboard";
    const v = raw.trim();
    if (!v.startsWith("/") || v.startsWith("//")) return "/dashboard";
    return v;
  }

  useEffect(() => {
    if (initializedFromQuery.current) return;
    initializedFromQuery.current = true;

    cleanupLegacySaaSTokens();

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    setNextPath(safeNext(params.get("next")));
    if (mode === "register") {
      setShowRegister(true);
      setShowReset(false);
    } else if (mode === "reset") {
      setShowReset(true);
      setShowRegister(false);
    }
  }, []);

  useEffect(() => {
    // Best-effort redirect if already logged in (session via cookie).
    api
      .get("/v1/auth/me")
      .then(() => router.replace(nextPath))
      .catch(() => {
        // ignore (not logged in)
      });
  }, [router, nextPath]);

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
      first_name: "",
      last_name: "",
      admin_email: "",
      admin_senha: "",
      admin_senha_confirm: ""
    }
  });

  const watchedTenantNome = registerForm.watch("tenant_nome");
  const watchedRegisterPassword = registerForm.watch("admin_senha");
  const pwdValidation = validatePassword(watchedRegisterPassword ?? "");
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
      await loginWithEmailSenha(values);
      router.replace(nextPath);
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
        first_name: values.first_name,
        last_name: values.last_name,
        admin_email: values.admin_email,
        admin_senha: values.admin_senha,
        cf_turnstile_response: turnstileToken ?? undefined
      };

      await registerTenantApi(payload);
      router.replace(nextPath);
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
                  <p className="text-sm text-emerald-600">
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
                setTurnstileToken(null);
                setTurnstileError(null);
              }}
            >
              {showRegister ? "Fechar cadastro" : "Criar conta grátis"}
            </Button>

            {showRegister ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={registerForm.handleSubmit((v) => {
                  if (turnstileEnabled && !turnstileToken) {
                    setTurnstileError("Confirme que você não é um robô.");
                    return;
                  }
                  registerTenant.mutate(v);
                })}
              >
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
                    <p className="text-xs text-muted-foreground">
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="reg_first_name">Primeiro nome</Label>
                    <Input id="reg_first_name" placeholder="Ex: Marco Aurélio" {...registerForm.register("first_name")} />
                    {registerForm.formState.errors.first_name?.message ? (
                      <p className="text-xs text-red-600">{registerForm.formState.errors.first_name.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reg_last_name">Sobrenome</Label>
                    <Input id="reg_last_name" placeholder="Ex: Silva" {...registerForm.register("last_name")} />
                    {registerForm.formState.errors.last_name?.message ? (
                      <p className="text-xs text-red-600">{registerForm.formState.errors.last_name.message}</p>
                    ) : null}
                  </div>
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

                  <div className="mt-2 rounded-xl border border-border/20 bg-card/40 p-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Requisitos de senha</p>
                    <ul className="mt-2 space-y-1">
                      <li className={pwdValidation.lengthOk ? "text-emerald-600" : "text-red-600"}>
                        • Mínimo 8 caracteres
                      </li>
                      <li className={pwdValidation.twoNumbersOk ? "text-emerald-600" : "text-red-600"}>
                        • Pelo menos 2 números
                      </li>
                      <li className={pwdValidation.specialOk ? "text-emerald-600" : "text-red-600"}>
                        • Pelo menos 1 caractere especial
                      </li>
                      <li className={pwdValidation.upperOk ? "text-emerald-600" : "text-red-600"}>
                        • Pelo menos 1 letra maiúscula
                      </li>
                      <li className={pwdValidation.lowerOk ? "text-emerald-600" : "text-red-600"}>
                        • Pelo menos 1 letra minúscula
                      </li>
                    </ul>
                  </div>
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

                {turnstileEnabled ? (
                  <div className="pt-2">
                    <Turnstile
                      siteKey={TURNSTILE_SITE_KEY}
                      onVerify={(token) => {
                        setTurnstileToken(token);
                        setTurnstileError(null);
                      }}
                      onExpire={() => {
                        setTurnstileToken(null);
                      }}
                      onError={() => {
                        setTurnstileToken(null);
                        setTurnstileError("Falha na verificação anti-robô. Recarregue a página e tente novamente.");
                      }}
                    />
                    {turnstileError ? <p className="mt-1 text-xs text-red-600">{turnstileError}</p> : null}
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  disabled={registerTenant.isPending || (turnstileEnabled && !turnstileToken) || !pwdValidation.allOk}
                  type="submit"
                >
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
