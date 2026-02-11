"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Parceria = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
};

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional(),
  oab_number: z.string().optional().or(z.literal("")),
  tipo_documento: z.enum(["cpf", "cnpj"]).default("cpf"),
  documento: z.string().min(8)
});
type FormValues = z.infer<typeof schema>;

export default function ParceriasPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => (await api.get<Parceria[]>("/v1/parcerias")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" }
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        email: values.email ? values.email : null,
        telefone: values.telefone ? values.telefone : null,
        oab_number: values.oab_number ? values.oab_number : null
      };
      if (editingId) return (await api.put(`/v1/parcerias/${editingId}`, payload)).data;
      return (await api.post("/v1/parcerias", payload)).data;
    },
    onSuccess: async () => {
      setEditingId(null);
      form.reset({ nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" });
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/parcerias/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
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
              <Label>Nome</Label>
              <Input {...form.register("nome")} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Telefone</Label>
              <Input {...form.register("telefone")} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>Número da OAB</Label>
              <Input placeholder="Ex: SP 123456" {...form.register("oab_number")} />
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
              <Input {...form.register("documento")} />
            </div>
            <div className="flex items-end gap-2 md:col-span-6">
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" });
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          {save.isError ? (
            <p className="mt-2 text-sm text-destructive">{(save.error as any)?.response?.data?.detail ?? "Erro ao salvar parceria"}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {list.data ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Doc</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell>{p.email ?? "—"}</TableCell>
                      <TableCell>{p.telefone ?? "—"}</TableCell>
                      <TableCell>{p.oab_number ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.tipo_documento}:{p.documento}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingId(p.id);
                              form.reset({
                                nome: p.nome,
                                email: p.email ?? "",
                                telefone: p.telefone ?? "",
                                oab_number: p.oab_number ?? "",
                                tipo_documento: p.tipo_documento,
                                documento: p.documento
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
          {list.isError ? (
            <p className="mt-2 text-sm text-destructive">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar parcerias"}</p>
          ) : null}
          {remove.isError ? (
            <p className="mt-2 text-sm text-destructive">{(remove.error as any)?.response?.data?.detail ?? "Erro ao excluir parceria"}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
