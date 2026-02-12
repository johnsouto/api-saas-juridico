"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { formatCEP, formatCNPJ, formatCPF, isValidCEPLength, onlyDigits } from "@/lib/masks";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  first_name: z.string().min(2, "Informe o primeiro nome.").max(200),
  last_name: z.string().min(2, "Informe o sobrenome.").max(200),
  oab_number: z.string().max(40).optional().or(z.literal("")),

  address_street: z.string().max(200).optional().or(z.literal("")),
  address_number: z.string().max(40).optional().or(z.literal("")),
  address_complement: z.string().max(200).optional().or(z.literal("")),
  address_neighborhood: z.string().max(120).optional().or(z.literal("")),
  address_city: z.string().max(120).optional().or(z.literal("")),
  address_state: z
    .string()
    .max(2)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: "UF inválida. Use 2 letras (ex: SP)." }),
  address_zip: z
    .string()
    .max(16)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidCEPLength(v), {
      message: "CEP incompleto. Informe 8 dígitos."
    })
});

type FormValues = z.infer<typeof schema>;

export default function PerfilPage() {
  const { user, tenant, refreshSession } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      oab_number: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: ""
    }
  });
  const zipDigits = onlyDigits(form.watch("address_zip") ?? "");
  const zipValid = !zipDigits || isValidCEPLength(zipDigits);

  useEffect(() => {
    if (!user || !tenant) return;
    form.reset({
      first_name: user.first_name ?? (user.nome?.split(/\s+/).filter(Boolean)[0] ?? ""),
      last_name: user.last_name ?? "",
      oab_number: user.oab_number ?? "",
      address_street: tenant.address_street ?? "",
      address_number: tenant.address_number ?? "",
      address_complement: tenant.address_complement ?? "",
      address_neighborhood: tenant.address_neighborhood ?? "",
      address_city: tenant.address_city ?? "",
      address_state: tenant.address_state ?? "",
      address_zip: tenant.address_zip ? formatCEP(tenant.address_zip) : ""
    });
  }, [form, tenant, user]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        oab_number: values.oab_number ? values.oab_number : null,

        address_street: values.address_street ? values.address_street : null,
        address_number: values.address_number ? values.address_number : null,
        address_complement: values.address_complement ? values.address_complement : null,
        address_neighborhood: values.address_neighborhood ? values.address_neighborhood : null,
        address_city: values.address_city ? values.address_city : null,
        address_state: values.address_state ? values.address_state.toUpperCase() : null,
        address_zip: values.address_zip ? onlyDigits(values.address_zip) : null
      };
      const r = await api.patch("/v1/profile/me", payload);
      return r.data;
    },
    onSuccess: async () => {
      toast("Perfil atualizado com sucesso.", { variant: "success" });
      await refreshSession();
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Seus dados e informações do seu escritório.</CardDescription>
        </CardHeader>
      </Card>

      <form className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Primeiro nome</Label>
                <Input {...form.register("first_name")} />
                {form.formState.errors.first_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>Sobrenome</Label>
                <Input {...form.register("last_name")} />
                {form.formState.errors.last_name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>E-mail</Label>
                <Input value={user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">O e-mail de login não pode ser alterado aqui por enquanto.</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Número da OAB</Label>
                <Input placeholder="Ex: SP 123456" {...form.register("oab_number")} />
                {form.formState.errors.oab_number ? (
                  <p className="text-xs text-destructive">{form.formState.errors.oab_number.message}</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do escritório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome do escritório</Label>
                <Input value={tenant?.nome ?? ""} disabled />
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={
                    tenant
                      ? `${tenant.tipo_documento.toUpperCase()} ${
                          tenant.tipo_documento === "cpf" ? formatCPF(tenant.documento) : formatCNPJ(tenant.documento)
                        }`
                      : ""
                  }
                  disabled
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/15 bg-card/30 p-3 backdrop-blur">
              <div className="text-sm font-semibold">Endereço</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label>Rua</Label>
                  <Input {...form.register("address_street")} />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input {...form.register("address_number")} />
                </div>
                <div className="space-y-1">
                  <Label>Complemento</Label>
                  <Input {...form.register("address_complement")} />
                </div>
                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input {...form.register("address_neighborhood")} />
                </div>
                <div className="space-y-1">
                  <Label>Cidade</Label>
                  <Input {...form.register("address_city")} />
                </div>
                <div className="space-y-1">
                  <Label>Estado (UF)</Label>
                  <Input placeholder="SP" {...form.register("address_state")} />
                  {form.formState.errors.address_state ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address_state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label>CEP</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    {...form.register("address_zip", {
                      onChange: (event) => {
                        const digits = onlyDigits(event.target.value);
                        const limited = digits.slice(0, 8);
                        const formatted = formatCEP(limited);
                        form.setValue("address_zip", formatted, { shouldValidate: true });
                      }
                    })}
                  />
                  {form.formState.errors.address_zip ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address_zip.message}</p>
                  ) : zipDigits && !zipValid ? (
                    <p className="text-xs text-destructive">CEP incompleto. Informe 8 dígitos.</p>
                  ) : null}
                </div>
              </div>
            </div>

            {save.isError ? (
              <div className="rounded-xl border border-border/20 bg-card/40 p-3 text-sm text-destructive">
                Não foi possível salvar o perfil.
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={save.isPending || !zipValid}>
                {save.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de risco!</CardTitle>
          <CardDescription>Essas ações estarão disponíveis em breve.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              // TODO: Integrar com billing/cancel.
              toast("Em breve: cancelamento de assinatura.", { variant: "default" });
            }}
          >
            Cancelar assinatura
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => {
              // TODO: Implementar exclusão de conta com confirmação e auditoria.
              toast("Em breve: exclusão de conta.", { variant: "default" });
            }}
          >
            Excluir conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
