"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    nova_senha: z.string().min(8, "Mínimo 8 caracteres"),
    confirmar: z.string().min(8, "Mínimo 8 caracteres")
  })
  .refine((v) => v.nova_senha === v.confirmar, { message: "As senhas não conferem", path: ["confirmar"] });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordUI() {
  const router = useRouter();
  const params = useSearchParams();

  const token = useMemo(() => params.get("token")?.trim() ?? "", [params]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nova_senha: "", confirmar: "" }
  });

  const confirm = useMutation({
    mutationFn: async (values: FormValues) => {
      await api.post("/v1/auth/reset-password/confirm", { token, nova_senha: values.nova_senha });
    },
    onSuccess: async () => {
      form.reset({ nova_senha: "", confirmar: "" });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <p className="text-sm text-red-600">Token ausente. Abra o link recebido por email.</p>
        ) : (
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => confirm.mutate(v))}>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" {...form.register("nova_senha")} />
              {form.formState.errors.nova_senha?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.nova_senha.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label>Confirmar senha</Label>
              <Input type="password" {...form.register("confirmar")} />
              {form.formState.errors.confirmar?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.confirmar.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={confirm.isPending} type="submit">
              {confirm.isPending ? "Salvando..." : "Atualizar senha"}
            </Button>

            {confirm.isSuccess ? (
              <div className="space-y-2">
                <p className="text-sm text-emerald-700">Senha atualizada. Você já pode entrar.</p>
                <Button className="w-full" type="button" variant="secondary" onClick={() => router.replace("/login")}>
                  Ir para login
                </Button>
              </div>
            ) : null}

            {confirm.isError ? (
              <p className="text-sm text-red-600">
                {(confirm.error as any)?.response?.data?.detail ?? "Erro ao atualizar senha"}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

