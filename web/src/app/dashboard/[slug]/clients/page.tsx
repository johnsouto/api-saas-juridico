"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { id: string; nome: string; cpf: string };

const schema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11)
});
type FormValues = z.infer<typeof schema>;

export default function ClientsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nome: "", cpf: "" } });

  const list = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      const r = await api.get<Client[]>("/v1/clients", { params: q ? { q } : {} });
      return r.data;
    }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editingId) {
        const r = await api.put<Client>(`/v1/clients/${editingId}`, values);
        return r.data;
      }
      const r = await api.post<Client>("/v1/clients", values);
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
          <CardDescription>Busca por CPF/Nome + documentos por cliente.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Editar cliente" : "Novo cliente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-2">
              <Label>Nome</Label>
              <Input placeholder="Nome do cliente" {...form.register("nome")} />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input placeholder="000.000.000-00" {...form.register("cpf")} />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ nome: "", cpf: "" });
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          {create.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(create.error as any)?.response?.data?.detail ?? "Erro ao salvar cliente"}
            </p>
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
              placeholder="Buscar por nome ou CPF…"
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
                    <TableHead>CPF</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          className="underline decoration-border/20 underline-offset-4 hover:decoration-border/40"
                          href={`./${c.id}`}
                        >
                          {c.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{c.cpf}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`./${c.id}`}>Abrir</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setEditingId(c.id);
                              form.reset({ nome: c.nome, cpf: c.cpf });
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
