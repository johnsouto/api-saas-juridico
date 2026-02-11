"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const schema = z.object({
  nome: z.string().min(2, "Informe o nome do cliente."),
  tipo_documento: z.enum(["cpf", "cnpj"]).default("cpf"),
  documento: z.string().min(8, "Informe o documento (CPF/CNPJ)."),
  phone_mobile: z.string().optional().or(z.literal("")),
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
    .refine((v) => !v || v.replace(/\D/g, "").length === 8, { message: "CEP inválido. Use 8 dígitos." })
});
type FormValues = z.infer<typeof schema>;

export default function ClientsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
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

  const list = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      const r = await api.get<Client[]>("/v1/clients", { params: q ? { q } : {} });
      return r.data;
    }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        phone_mobile: values.phone_mobile ? values.phone_mobile : null,
        email: values.email ? values.email : null,
        address_street: values.address_street ? values.address_street : null,
        address_number: values.address_number ? values.address_number : null,
        address_complement: values.address_complement ? values.address_complement : null,
        address_neighborhood: values.address_neighborhood ? values.address_neighborhood : null,
        address_city: values.address_city ? values.address_city : null,
        address_state: values.address_state ? values.address_state.toUpperCase() : null,
        address_zip: values.address_zip ? values.address_zip : null
      };
      if (editingId) {
        const r = await api.put<Client>(`/v1/clients/${editingId}`, payload);
        return r.data;
      }
      const r = await api.post<Client>("/v1/clients", payload);
      return r.data;
    },
    onSuccess: async () => {
      setEditingId(null);
      form.reset();
      await qc.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/clients/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>Busca por Documento/Nome + documentos por cliente.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Editar cliente" : "Novo cliente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-3">
              <Label>Nome</Label>
              <Input placeholder="Nome do cliente" {...form.register("nome")} />
              {form.formState.errors.nome ? <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>Tipo</Label>
              <Select {...form.register("tipo_documento")}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Documento</Label>
              <Input placeholder="Somente números" {...form.register("documento")} />
              {form.formState.errors.documento ? <p className="text-xs text-destructive">{form.formState.errors.documento.message}</p> : null}
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label>E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" {...form.register("email")} />
              {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Celular</Label>
              <Input placeholder="(11) 99999-9999" {...form.register("phone_mobile")} />
            </div>

            <div className="rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur md:col-span-6">
              <div className="text-sm font-semibold">Endereço (opcional)</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="space-y-1 md:col-span-4">
                  <Label>Rua</Label>
                  <Input {...form.register("address_street")} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Número</Label>
                  <Input {...form.register("address_number")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Complemento</Label>
                  <Input {...form.register("address_complement")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Bairro</Label>
                  <Input {...form.register("address_neighborhood")} />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>Cidade</Label>
                  <Input {...form.register("address_city")} />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label>UF</Label>
                  <Input placeholder="SP" {...form.register("address_state")} />
                  {form.formState.errors.address_state ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address_state.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>CEP</Label>
                  <Input placeholder="01001000" {...form.register("address_zip")} />
                  {form.formState.errors.address_zip ? (
                    <p className="text-xs text-destructive">{form.formState.errors.address_zip.message}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-end gap-2 md:col-span-6">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
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
                {(create.error as any)?.response?.data?.detail ?? "Erro ao salvar cliente"}
              </p>
              {(create.error as any)?.response?.data?.code === "PLAN_LIMIT_REACHED" &&
              (create.error as any)?.response?.data?.resource === "clients" ? (
                <div className="mt-2">
                  <Button asChild size="sm">
                    <Link href="/billing?plan=plus&next=/dashboard">Assinar Plus</Link>
                  </Button>
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
          {list.data ? (
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
                        {c.tipo_documento.toUpperCase()}: {c.documento}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/${slug}/clients/${c.id}`}>Abrir</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setEditingId(c.id);
                              form.reset({
                                nome: c.nome,
                                tipo_documento: c.tipo_documento,
                                documento: c.documento,
                                phone_mobile: c.phone_mobile ?? "",
                                email: c.email ?? "",
                                address_street: c.address_street ?? "",
                                address_number: c.address_number ?? "",
                                address_complement: c.address_complement ?? "",
                                address_neighborhood: c.address_neighborhood ?? "",
                                address_city: c.address_city ?? "",
                                address_state: c.address_state ?? "",
                                address_zip: c.address_zip ?? ""
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

          {list.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(list.error as any)?.response?.data?.detail ?? "Erro ao listar clientes"}
            </p>
          ) : null}
          {remove.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(remove.error as any)?.response?.data?.detail ?? "Erro ao excluir cliente"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
