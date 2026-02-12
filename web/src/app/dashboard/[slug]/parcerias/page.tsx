"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatPhoneBR,
  isValidCEPLength,
  isValidCNPJLength,
  isValidCPFLength,
  isValidPhoneLength,
  onlyDigits
} from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Parceria = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  oab_uf?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
};

const schema = z.object({
  nome: z.string().min(2, "Informe o nome do parceiro."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  telefone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidPhoneLength(v), { message: "Telefone incompleto. Informe DDD + número com 11 dígitos." }),
  oab_uf: z.string().optional().or(z.literal("")),
  oab_number: z.string().optional().or(z.literal("")),
  tipo_documento: z.enum(["cpf", "cnpj"]).default("cpf"),
  documento: z.string().min(1, "Informe o documento."),
  address_street: z.string().optional().or(z.literal("")),
  address_number: z.string().optional().or(z.literal("")),
  address_complement: z.string().optional().or(z.literal("")),
  address_neighborhood: z.string().optional().or(z.literal("")),
  address_city: z.string().optional().or(z.literal("")),
  address_state: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: "UF inválida. Use 2 letras (ex: SP)." }),
  address_zip: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidCEPLength(v), { message: "CEP incompleto. Informe 8 dígitos." })
}).superRefine((data, ctx) => {
  const digits = onlyDigits(data.documento);
  if (data.tipo_documento === "cpf" && !isValidCPFLength(digits)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["documento"],
      message: "CPF incompleto. Informe 11 dígitos."
    });
  }
  if (data.tipo_documento === "cnpj" && !isValidCNPJLength(digits)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["documento"],
      message: "CNPJ incompleto. Informe 14 dígitos."
    });
  }
});
type FormValues = z.infer<typeof schema>;

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO"
];

export default function ParceriasPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const params = useParams<{ slug: string }>();
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => (await api.get<Parceria[]>("/v1/parcerias")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      oab_uf: "",
      oab_number: "",
      tipo_documento: "cpf",
      documento: "",
      address_street: "",
      address_number: "",
      address_complement: "",
      address_neighborhood: "",
      address_city: "",
      address_state: "",
      address_zip: ""
    }
  });
  const docType = form.watch("tipo_documento");
  const docDigits = onlyDigits(form.watch("documento") ?? "");
  const docValid = docType === "cpf" ? isValidCPFLength(docDigits) : isValidCNPJLength(docDigits);
  const phoneDigits = onlyDigits(form.watch("telefone") ?? "");
  const phoneValid = !phoneDigits || isValidPhoneLength(phoneDigits);
  const zipDigits = onlyDigits(form.watch("address_zip") ?? "");
  const zipValid = !zipDigits || isValidCEPLength(zipDigits);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        email: values.email ? values.email : null,
        telefone: values.telefone ? onlyDigits(values.telefone) : null,
        oab_uf: values.oab_uf ? values.oab_uf.toUpperCase() : null,
        oab_number: values.oab_number ? values.oab_number : null,
        documento: onlyDigits(values.documento),
        address_street: values.address_street ? values.address_street : null,
        address_number: values.address_number ? values.address_number : null,
        address_complement: values.address_complement ? values.address_complement : null,
        address_neighborhood: values.address_neighborhood ? values.address_neighborhood : null,
        address_city: values.address_city ? values.address_city : null,
        address_state: values.address_state ? values.address_state.toUpperCase() : null,
        address_zip: values.address_zip ? onlyDigits(values.address_zip) : null
      };
      if (editingId) return (await api.put(`/v1/parcerias/${editingId}`, payload)).data;
      return (await api.post("/v1/parcerias", payload)).data;
    },
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      form.reset({
        nome: "",
        email: "",
        telefone: "",
        oab_uf: "",
        oab_number: "",
        tipo_documento: "cpf",
        documento: "",
        address_street: "",
        address_number: "",
        address_complement: "",
        address_neighborhood: "",
        address_city: "",
        address_state: "",
        address_zip: ""
      });
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
      toast(wasEditing ? "Parceria atualizada com sucesso." : "Parceria cadastrada com sucesso.", {
        variant: "success"
      });
    },
    onError: () => {
      toast("Não foi possível salvar a parceria. Tente novamente.", { variant: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/parcerias/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
      toast("Parceria excluída.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível excluir a parceria. Tente novamente.", { variant: "error" });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Parcerias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cadastre parceiros e vincule processos a eles (opcional).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editingId ? "Editar parceiro" : "Novo parceiro"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="parceria_nome">Nome *</Label>
              <Input id="parceria_nome" placeholder="Nome do parceiro" {...form.register("nome")} />
              {form.formState.errors.nome ? <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="parceria_email">E-mail (opcional)</Label>
              <Input id="parceria_email" type="email" placeholder="email@exemplo.com" {...form.register("email")} />
              {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parceria_telefone">Telefone (opcional)</Label>
              <Input
                id="parceria_telefone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                {...form.register("telefone", {
                  onChange: (event) => {
                    const digits = onlyDigits(event.target.value);
                    const limited = digits.slice(0, 11);
                    const formatted = formatPhoneBR(limited);
                    form.setValue("telefone", formatted, { shouldValidate: true });
                  }
                })}
              />
              {form.formState.errors.telefone ? (
                <p className="text-xs text-destructive">{form.formState.errors.telefone.message}</p>
              ) : phoneDigits && !phoneValid ? (
                <p className="text-xs text-destructive">
                  Telefone incompleto. Informe DDD + número com 11 dígitos.
                </p>
              ) : null}
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="parceria_oab_uf">UF OAB (opcional)</Label>
              <Select id="parceria_oab_uf" {...form.register("oab_uf")}>
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="parceria_oab">Nº OAB (opcional)</Label>
              <Input id="parceria_oab" placeholder="Ex: 123456" {...form.register("oab_number")} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="parceria_tipo">Tipo *</Label>
              <Select
                id="parceria_tipo"
                {...form.register("tipo_documento", {
                  onChange: (event) => {
                    const nextType = event.target.value as "cpf" | "cnpj";
                    const digits = onlyDigits(form.getValues("documento") ?? "");
                    const limited = digits.slice(0, nextType === "cpf" ? 11 : 14);
                    const formatted = nextType === "cpf" ? formatCPF(limited) : formatCNPJ(limited);
                    form.setValue("documento", formatted, { shouldValidate: true });
                  }
                })}
              >
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parceria_documento">Documento *</Label>
              <Input
                id="parceria_documento"
                inputMode="numeric"
                placeholder="Somente números"
                {...form.register("documento", {
                  onChange: (e) => {
                    const digits = onlyDigits(e.target.value);
                    const limited = digits.slice(0, docType === "cpf" ? 11 : 14);
                    const formatted = docType === "cpf" ? formatCPF(limited) : formatCNPJ(limited);
                    form.setValue("documento", formatted, { shouldValidate: true });
                  }
                })}
              />
              {form.formState.errors.documento ? (
                <p className="text-xs text-destructive">{form.formState.errors.documento.message}</p>
              ) : docDigits && !docValid ? (
                <p className="text-xs text-destructive">
                  {docType === "cpf"
                    ? "CPF incompleto. Informe 11 dígitos."
                    : "CNPJ incompleto. Informe 14 dígitos."}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur md:col-span-6">
              <div className="text-sm font-semibold">Endereço (opcional)</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-4">
                  <Label htmlFor="parceria_rua">Rua</Label>
                  <Input id="parceria_rua" {...form.register("address_street")} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="parceria_numero">Número</Label>
                  <Input id="parceria_numero" {...form.register("address_number")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="parceria_complemento">Complemento</Label>
                  <Input id="parceria_complemento" {...form.register("address_complement")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="parceria_bairro">Bairro</Label>
                  <Input id="parceria_bairro" {...form.register("address_neighborhood")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="parceria_cidade">Cidade</Label>
                  <Input id="parceria_cidade" {...form.register("address_city")} />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label htmlFor="parceria_uf">UF</Label>
                  <Select id="parceria_uf" {...form.register("address_state")}>
                    <option value="">UF</option>
                    {UFS.map((uf) => (
                      <option key={`addr-${uf}`} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.address_state ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address_state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="parceria_cep">CEP</Label>
                  <Input
                    id="parceria_cep"
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
            <div className="flex items-end gap-2 md:col-span-6">
              <Button disabled={save.isPending || !docValid || !phoneValid || !zipValid} type="submit">
                {save.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({
                      nome: "",
                      email: "",
                      telefone: "",
                      oab_uf: "",
                      oab_number: "",
                      tipo_documento: "cpf",
                      documento: "",
                      address_street: "",
                      address_number: "",
                      address_complement: "",
                      address_neighborhood: "",
                      address_city: "",
                      address_state: "",
                      address_zip: ""
                    });
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          {save.isError ? <p className="mt-2 text-sm text-destructive">Não foi possível salvar a parceria.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {list.data && list.data.length === 0 ? (
            <div className="mt-3 rounded-xl border border-border/20 bg-card/40 p-6 text-sm text-muted-foreground">
              <p>Nenhuma parceria cadastrada ainda.</p>
              <Button
                className="mt-3"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Cadastrar primeira parceria
              </Button>
            </div>
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell>{p.email ?? "—"}</TableCell>
                      <TableCell>{p.telefone ? formatPhoneBR(p.telefone) : "—"}</TableCell>
                      <TableCell>{p.oab_number ? [p.oab_uf, p.oab_number].filter(Boolean).join(" ") : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.tipo_documento}:{p.tipo_documento === "cpf" ? formatCPF(p.documento) : formatCNPJ(p.documento)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline" type="button">
                            <Link href={`/dashboard/${params.slug}/parcerias/${p.id}`}>Abrir</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingId(p.id);
                              form.reset({
                                nome: p.nome,
                                email: p.email ?? "",
                                telefone: p.telefone ? formatPhoneBR(p.telefone) : "",
                                oab_uf: p.oab_uf ?? "",
                                oab_number: p.oab_number ?? "",
                                tipo_documento: p.tipo_documento,
                                documento: p.tipo_documento === "cpf" ? formatCPF(p.documento) : formatCNPJ(p.documento),
                                address_street: p.address_street ?? "",
                                address_number: p.address_number ?? "",
                                address_complement: p.address_complement ?? "",
                                address_neighborhood: p.address_neighborhood ?? "",
                                address_city: p.address_city ?? "",
                                address_state: p.address_state ?? "",
                                address_zip: p.address_zip ? formatCEP(p.address_zip) : ""
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(p.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {list.isError ? <p className="mt-2 text-sm text-destructive">Erro ao listar parcerias.</p> : null}
          {remove.isError ? <p className="mt-2 text-sm text-destructive">Erro ao excluir parceria.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
