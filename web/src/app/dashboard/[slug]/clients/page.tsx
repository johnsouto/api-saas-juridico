"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { PlusPriceOffer } from "@/components/billing/PlusPriceOffer";
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
import { PageHeaderCard } from "@/components/ui/PageHeaderCard";
import { AddressFields } from "@/components/forms/AddressFields";

type Client = {
  id: string;
  nome: string;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  phone_mobile?: string | null;
  email?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
};
type Parceria = { id: string; nome: string };

const schema = z.object({
  nome: z.string().min(2, "Informe o nome do cliente."),
  tipo_documento: z.enum(["cpf", "cnpj"]).default("cpf"),
  documento: z.string().min(1, "Informe o documento (CPF/CNPJ)."),
  phone_mobile: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidPhoneLength(v), { message: "Telefone incompleto. Informe DDD + número com 11 dígitos." }),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),

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

export default function ClientsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
  const [partnershipCandidateId, setPartnershipCandidateId] = useState<string>("");
  const [selectedPartnershipIds, setSelectedPartnershipIds] = useState<string[]>([]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      tipo_documento: "cpf",
      documento: "",
      phone_mobile: "",
      email: "",
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
  const phoneDigits = onlyDigits(form.watch("phone_mobile") ?? "");
  const phoneValid = !phoneDigits || isValidPhoneLength(phoneDigits);
  const zipDigits = onlyDigits(form.watch("address_zip") ?? "");
  const zipValid = !zipDigits || isValidCEPLength(zipDigits);

  const list = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      const r = await api.get<Client[]>("/v1/clients", { params: q ? { q } : {} });
      return r.data;
    }
  });
  const partnerships = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => {
      const response = await api.get<Parceria[]>("/v1/parcerias");
      return response.data;
    }
  });
  const partnershipsById = useMemo(
    () => new Map((partnerships.data ?? []).map((item) => [item.id, item.nome])),
    [partnerships.data]
  );

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        documento: onlyDigits(values.documento),
        phone_mobile: values.phone_mobile ? onlyDigits(values.phone_mobile) : null,
        email: values.email ? values.email : null,
        address_street: values.address_street ? values.address_street : null,
        address_number: values.address_number ? values.address_number : null,
        address_complement: values.address_complement ? values.address_complement : null,
        address_neighborhood: values.address_neighborhood ? values.address_neighborhood : null,
        address_city: values.address_city ? values.address_city : null,
        address_state: values.address_state ? values.address_state.toUpperCase() : null,
        address_zip: values.address_zip ? onlyDigits(values.address_zip) : null
      };
      if (editingId) {
        const r = await api.put<Client>(`/v1/clients/${editingId}`, payload);
        return r.data;
      }
      const r = await api.post<Client>("/v1/clients", payload);
      return r.data;
    },
    onSuccess: async (savedClient) => {
      try {
        await api.put(`/v1/clients/${savedClient.id}/partnerships`, { partnership_ids: selectedPartnershipIds });
      } catch {
        toast("Cliente salvo, mas não foi possível atualizar parcerias vinculadas.", { variant: "error" });
      }
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setSelectedPartnershipIds([]);
      setPartnershipCandidateId("");
      form.reset();
      await qc.invalidateQueries({ queryKey: ["clients"] });
      await qc.invalidateQueries({ queryKey: ["client-details", savedClient.id] });
      toast(wasEditing ? "Cliente atualizado com sucesso." : "Cliente cadastrado com sucesso.", {
        variant: "success"
      });
    },
    onError: (error: any) => {
      const code = error?.response?.data?.code;
      if (code === "PLAN_LIMIT_REACHED") {
        toast("Limite do Plano Free atingido: até 3 clientes. Assine o Plus para cadastrar mais.", {
          variant: "error",
          durationMs: 4800
        });
        return;
      }
      toast("Não foi possível salvar o cliente. Tente novamente.", { variant: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/clients/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast("Cliente excluído.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível excluir. Verifique vínculos com processos, documentos ou honorários.", {
        variant: "error",
        durationMs: 4800
      });
    }
  });

  return (
    <div className="space-y-4">
      <PageHeaderCard
        title="Clientes"
        description="Gerencie cadastros, consulte a base completa e vincule parcerias."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Editar cliente" : "Novo cliente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="cliente_nome">Nome *</Label>
              <Input id="cliente_nome" placeholder="Nome do cliente" {...form.register("nome")} />
              {form.formState.errors.nome ? <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="cliente_tipo">Tipo *</Label>
              <Select
                id="cliente_tipo"
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
              <Label htmlFor="cliente_documento">Documento *</Label>
              <Input
                id="cliente_documento"
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

            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="cliente_email">E-mail</Label>
              <Input id="cliente_email" type="email" placeholder="email@exemplo.com" {...form.register("email")} />
              {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="cliente_celular">Celular</Label>
              <Input
                id="cliente_celular"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                {...form.register("phone_mobile", {
                  onChange: (event) => {
                    const digits = onlyDigits(event.target.value);
                    const limited = digits.slice(0, 11);
                    const formatted = formatPhoneBR(limited);
                    form.setValue("phone_mobile", formatted, { shouldValidate: true });
                  }
                })}
              />
              {form.formState.errors.phone_mobile ? (
                <p className="text-xs text-destructive">{form.formState.errors.phone_mobile.message}</p>
              ) : phoneDigits && !phoneValid ? (
                <p className="text-xs text-destructive">
                  Telefone incompleto. Informe DDD + número com 11 dígitos.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur md:col-span-6">
              <div className="text-sm font-semibold">Parcerias vinculadas</div>
              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                <Select value={partnershipCandidateId} onChange={(event) => setPartnershipCandidateId(event.target.value)}>
                  <option value="">Selecione uma parceria</option>
                  {(partnerships.data ?? []).map((partnership) => (
                    <option key={partnership.id} value={partnership.id}>
                      {partnership.nome}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!partnershipCandidateId) return;
                    setSelectedPartnershipIds((current) =>
                      current.includes(partnershipCandidateId) ? current : [...current, partnershipCandidateId]
                    );
                    setPartnershipCandidateId("");
                  }}
                >
                  Vincular parceria
                </Button>
              </div>
              {selectedPartnershipIds.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedPartnershipIds.map((partnershipId) => (
                    <div
                      key={partnershipId}
                      className="inline-flex items-center gap-2 rounded-full border border-border/25 bg-card/40 px-3 py-1 text-xs"
                    >
                      <span>{partnershipsById.get(partnershipId) ?? partnershipId}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setSelectedPartnershipIds((current) => current.filter((item) => item !== partnershipId))
                        }
                        aria-label="Remover parceria vinculada"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Nenhuma parceria vinculada.</p>
              )}
            </div>

            <AddressFields
              className="md:col-span-6"
              form={form}
              idPrefix="cliente"
              zipInvalid={Boolean(zipDigits && !zipValid)}
            />

            <div className="flex items-end gap-2 md:col-span-6">
              <Button disabled={create.isPending || !docValid || !phoneValid || !zipValid} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setSelectedPartnershipIds([]);
                    setPartnershipCandidateId("");
                    form.reset();
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          {create.isError ? (
            <div className="mt-3 rounded-xl border border-border/20 bg-card/40 p-3 text-sm text-destructive">
              <p>
                {(create.error as any)?.response?.data?.code === "PLAN_LIMIT_REACHED"
                  ? "Limite do Plano Free atingido: até 3 clientes. Assine o Plus para cadastrar mais."
                  : "Não foi possível salvar o cliente. Tente novamente."}
              </p>
              {(create.error as any)?.response?.data?.code === "PLAN_LIMIT_REACHED" &&
              (create.error as any)?.response?.data?.resource === "clients" ? (
                <div className="mt-2 space-y-2">
                  <Button asChild size="sm">
                    <Link href="/billing?plan=plus&next=/dashboard">Assinar Plus</Link>
                  </Button>
                  <PlusPriceOffer variant="compact" />
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nome ou documento…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="outline" type="button" onClick={() => setQ("")}>
              Limpar
            </Button>
          </div>

          {list.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Carregando…</p> : null}
          {list.data && list.data.length === 0 ? (
            <div className="mt-4 rounded-xl border border-border/20 bg-card/40 p-6 text-sm text-muted-foreground">
              <p>Nenhum cliente cadastrado ainda.</p>
              <Button
                className="mt-3"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Cadastrar primeiro cliente
              </Button>
            </div>
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          className="underline decoration-border/20 underline-offset-4 hover:decoration-border/40"
                          href={`/dashboard/${slug}/clients/${c.id}`}
                        >
                          {c.nome}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.tipo_documento.toUpperCase()}:{" "}
                        {c.tipo_documento === "cpf" ? formatCPF(c.documento) : formatCNPJ(c.documento)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/${slug}/clients/${c.id}`}>Abrir</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/${slug}/clients/${c.id}#caso-concreto`}>Caso concreto</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={async () => {
                              setEditingId(c.id);
                              try {
                                const linked = await api.get<Parceria[]>(`/v1/clients/${c.id}/partnerships`);
                                setSelectedPartnershipIds(linked.data.map((item) => item.id));
                              } catch {
                                setSelectedPartnershipIds([]);
                                toast("Não foi possível carregar parcerias vinculadas deste cliente.", { variant: "error" });
                              }
                              form.reset({
                                nome: c.nome,
                                tipo_documento: c.tipo_documento,
                                documento: c.tipo_documento === "cpf" ? formatCPF(c.documento) : formatCNPJ(c.documento),
                                phone_mobile: c.phone_mobile ? formatPhoneBR(c.phone_mobile) : "",
                                email: c.email ?? "",
                                address_street: c.address_street ?? "",
                                address_number: c.address_number ?? "",
                                address_complement: c.address_complement ?? "",
                                address_neighborhood: c.address_neighborhood ?? "",
                                address_city: c.address_city ?? "",
                                address_state: c.address_state ?? "",
                                address_zip: c.address_zip ? formatCEP(c.address_zip) : ""
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(c.id)}
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

          {list.isError ? <p className="mt-3 text-sm text-destructive">Erro ao listar clientes.</p> : null}
          {remove.isError ? (
            <p className="mt-3 text-sm text-destructive">
              Não foi possível excluir. Verifique vínculos com processos, documentos ou honorários.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
