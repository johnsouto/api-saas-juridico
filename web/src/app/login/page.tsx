"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { getAccessToken, setTokens, type TokenPair } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();

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

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Use o usuário seed: admin@demo.local / admin12345</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => login.mutate(v))}>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Senha</Label>
              <Input type="password" {...form.register("senha")} />
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
        </CardContent>
      </Card>
    </main>
  );
}
