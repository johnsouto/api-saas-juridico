"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { id: string; nome: string };
type Parceria = { id: string; nome: string };
type Proc = {
  id: string;
  numero: string;
  status: "ativo" | "inativo" | "outros";
  nicho?: string | null;
  client_id: string;
  parceria_id?: string | null;
};

const schema = z.object({
  client_id: z.string().uuid(),
  parceria_id: z.string().uuid().optional().or(z.literal("")),
  numero: z.string().min(3),
  status: z.enum(["ativo", "inativo", "outros"]).default("ativo"),
  nicho: z.string().optional().or(z.literal(""))
});
type FormValues = z.infer<typeof schema>;

const NICHOS = [
  { value: "Militar", label: "Militar" },
  { value: "Bancário", label: "Bancário" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "penal", label: "Penal" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "tributario", label: "Tributário" },
  { value: "consumidor", label: "Consumidor" },
  { value: "imobiliario", label: "Imobiliário" },
  { value: "empresarial", label: "Empresarial" },
  { value: "outros", label: "Outros" }
];

export default function ProcessesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });

  const parcerias = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => (await api.get<Parceria[]>("/v1/parcerias")).data
  });

  const list = useQuery({
    queryKey: ["processes"],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { client_id: "", parceria_id: "", numero: "", status: "ativo", nicho: "" }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        client_id: values.client_id,
        parceria_id: values.parceria_id ? values.parceria_id : null,
        numero: values.numero,
        status: values.status,
        nicho: values.nicho ? values.nicho : null
      };
      if (editingId) {
        return (await api.put<Proc>(`/v1/processes/${editingId}`, payload)).data;
      }
      return (await api.post<Proc>("/v1/processes", payload)).data;
    },
    onSuccess: async () => {
      setEditingId(null);
      form.reset({ client_id: "", parceria_id: "", numero: "", status: "ativo", nicho: "" });
      await qc.invalidateQueries({ queryKey: ["processes"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/processes/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["processes"] });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Processos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600">Número é único por tenant.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editingId ? "Editar processo" : "Novo processo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select {...form.register("client_id")}>
                <option value="">Selecione o cliente</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Parceria (opcional)</Label>
              <Select {...form.register("parceria_id")}>
                <option value="">(sem parceria)</option>
                {parcerias.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Número</Label>
              <Input placeholder="Número" {...form.register("numero")} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select {...form.register("status")}>
                <option value="ativo">ativo</option>
                <option value="inativo">inativo</option>
                <option value="outros">outros</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nicho</Label>
              <Select {...form.register("nicho")}>
                <option value="">(opcional) Selecione</option>
                {NICHOS.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2 md:col-span-1">
              <Button className="w-full" disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </form>

          {editingId ? (
            <Button
              className="mt-3"
              variant="secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                form.reset({ client_id: "", parceria_id: "", numero: "", status: "ativo", nicho: "" });
              }}
            >
              Cancelar edição
            </Button>
          ) : null}

          {create.isError ? (
            <p className="mt-2 text-sm text-red-600">{(create.error as any)?.response?.data?.detail ?? "Erro ao salvar processo"}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
        {list.isLoading ? <p className="mt-2 text-sm text-zinc-600">Carregando…</p> : null}
        {list.data ? (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nicho</TableHead>
                  <TableHead>Parceria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.numero}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{p.nicho ?? "—"}</TableCell>
                    <TableCell>
                      {p.parceria_id ? parcerias.data?.find((x) => x.id === p.parceria_id)?.nome ?? "—" : "—"}
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
                              client_id: p.client_id,
                              parceria_id: p.parceria_id ?? "",
                              numero: p.numero,
                              status: p.status,
                              nicho: p.nicho ?? ""
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
          <p className="mt-2 text-sm text-red-600">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar processos"}</p>
        ) : null}
        {remove.isError ? (
          <p className="mt-2 text-sm text-red-600">{(remove.error as any)?.response?.data?.detail ?? "Erro ao excluir processo"}</p>
        ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
