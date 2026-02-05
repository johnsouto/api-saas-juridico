"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { setTokens, type TokenPair } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    senha: z.string().min(8, "Mínimo 8 caracteres"),
    senha2: z.string().min(8, "Mínimo 8 caracteres")
  })
  .refine((v) => v.senha === v.senha2, { message: "Senhas não conferem", path: ["senha2"] });

type FormValues = z.infer<typeof schema>;

export default function AcceptInviteClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { senha: "", senha2: "" }
  });

  const accept = useMutation({
    mutationFn: async (values: FormValues) => {
      const r = await api.post<TokenPair>("/v1/auth/accept-invite", { token, senha: values.senha });
      setTokens(r.data);
      const t = await api.get<{ slug: string }>("/v1/tenants/me");
      router.replace(`/dashboard/${t.data.slug}`);
    }
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Primeiro acesso</CardTitle>
          <CardDescription>Defina sua senha para acessar o sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => accept.mutate(v))}>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" {...form.register("senha")} />
              {form.formState.errors.senha?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.senha.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Confirmar senha</Label>
              <Input type="password" {...form.register("senha2")} />
              {form.formState.errors.senha2?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.senha2.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={accept.isPending || !token} type="submit">
              {accept.isPending ? "Salvando..." : "Concluir"}
            </Button>

            {accept.isError ? (
              <p className="text-sm text-red-600">
                {(accept.error as any)?.response?.data?.detail ?? "Falha ao aceitar convite"}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

