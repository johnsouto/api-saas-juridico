"use client";

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { passwordPolicyMessage, validatePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const passwordSchema = z
  .string()
  .min(8, passwordPolicyMessage)
  .refine((pwd) => validatePassword(pwd).allOk, passwordPolicyMessage);

const schema = z
  .object({
    nova_senha: passwordSchema,
    confirmar: z.string().min(1, "Confirme a senha")
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

  const watchedPwd = form.watch("nova_senha") ?? "";
  const pwdValidation = validatePassword(watchedPwd);

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
          <p className="text-sm text-destructive">Token ausente. Abra o link recebido por email.</p>
        ) : (
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => confirm.mutate(v))}>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" {...form.register("nova_senha")} />
              {form.formState.errors.nova_senha?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.nova_senha.message}</p>
              ) : null}

              <div className="mt-2 rounded-xl border border-border/20 bg-card/40 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Requisitos de senha</p>
                <ul className="mt-2 space-y-1">
                  <li className={pwdValidation.lengthOk ? "text-emerald-600" : "text-destructive"}>
                    • Mínimo 8 caracteres
                  </li>
                  <li className={pwdValidation.twoNumbersOk ? "text-emerald-600" : "text-destructive"}>
                    • Pelo menos 2 números
                  </li>
                  <li className={pwdValidation.specialOk ? "text-emerald-600" : "text-destructive"}>
                    • Pelo menos 1 caractere especial
                  </li>
                  <li className={pwdValidation.upperOk ? "text-emerald-600" : "text-destructive"}>
                    • Pelo menos 1 letra maiúscula
                  </li>
                  <li className={pwdValidation.lowerOk ? "text-emerald-600" : "text-destructive"}>
                    • Pelo menos 1 letra minúscula
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Confirmar senha</Label>
              <Input type="password" {...form.register("confirmar")} />
              {form.formState.errors.confirmar?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.confirmar.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={confirm.isPending || !pwdValidation.allOk} type="submit">
              {confirm.isPending ? "Salvando..." : "Atualizar senha"}
            </Button>

            {confirm.isSuccess ? (
              <div className="space-y-2">
                <p className="text-sm text-emerald-600">Senha atualizada. Você já pode entrar.</p>
                <Button className="w-full" type="button" variant="secondary" onClick={() => router.replace("/login")}>
                  Ir para login
                </Button>
              </div>
            ) : null}

            {confirm.isError ? (
              <p className="text-sm text-destructive">
                {(confirm.error as any)?.response?.data?.detail ?? "Erro ao atualizar senha"}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
