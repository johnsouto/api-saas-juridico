"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
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
    senha: passwordSchema,
    senha2: z.string().min(1, "Confirme a senha")
  })
  .refine((v) => v.senha === v.senha2, { message: "Senhas não conferem", path: ["senha2"] });

type FormValues = z.infer<typeof schema>;

export default function AcceptInviteClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";
  const next = sp.get("next") ?? "/dashboard";

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { senha: "", senha2: "" }
  });

  const watchedPwd = form.watch("senha") ?? "";
  const pwdValidation = validatePassword(watchedPwd);

  const accept = useMutation({
    mutationFn: async (values: FormValues) => {
      await api.post("/v1/auth/accept-invite", { token, senha: values.senha });
      router.replace(next);
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
                <p className="text-xs text-destructive">{form.formState.errors.senha.message}</p>
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
              <Input type="password" {...form.register("senha2")} />
              {form.formState.errors.senha2?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.senha2.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={accept.isPending || !token || !pwdValidation.allOk} type="submit">
              {accept.isPending ? "Salvando..." : "Concluir"}
            </Button>

            {accept.isError ? (
              <p className="text-sm text-destructive">
                {(accept.error as any)?.response?.data?.detail ?? "Falha ao aceitar convite"}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
