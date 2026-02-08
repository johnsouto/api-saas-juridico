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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBR } from "@/lib/format";

type Client = { id: string; nome: string };
type Tarefa = { id: string; titulo: string; descricao?: string | null; status: string; prazo_em?: string | null; client_id?: string | null };

const schema = z.object({
  titulo: z.string().min(2),
  descricao: z.string().optional(),
  prazo_em: z.string().optional(),
  client_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["pendente", "em_andamento", "concluido"]).default("pendente")
});
type FormValues = z.infer<typeof schema>;

export default function TarefasPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });
  const list = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => (await api.get<Tarefa[]>("/v1/tarefas")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titulo: "", descricao: "", prazo_em: "", client_id: "", status: "pendente" }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {
        titulo: values.titulo,
        descricao: values.descricao ? values.descricao : null,
        status: values.status,
        client_id: values.client_id ? values.client_id : null,
        prazo_em: values.prazo_em ? new Date(values.prazo_em).toISOString() : null
      };
      if (editingId) {
        return (await api.put(`/v1/tarefas/${editingId}`, payload)).data;
      }
      return (await api.post("/v1/tarefas", payload)).data;
    },
    onSuccess: async () => {
      setEditingId(null);
      form.reset({ titulo: "", descricao: "", prazo_em: "", client_id: "", status: "pendente" });
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tarefa> }) => {
      await api.put(`/v1/tarefas/${id}`, patch);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/tarefas/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tarefas</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editingId ? "Editar tarefa" : "Nova tarefa"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-2">
              <Label>Título</Label>
              <Input placeholder="Título" {...form.register("titulo")} />
            </div>

            <div className="space-y-1">
              <Label>Cliente (opcional)</Label>
              <Select {...form.register("client_id")}>
                <option value="">(sem cliente)</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select {...form.register("status")}>
                <option value="pendente">pendente</option>
                <option value="em_andamento">em andamento</option>
                <option value="concluido">concluído</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input className="min-w-[260px]" type="datetime-local" {...form.register("prazo_em")} />
            </div>

            <div className="space-y-1 md:col-span-4">
              <Label>Descrição</Label>
              <Textarea placeholder="(opcional)" {...form.register("descricao")} />
            </div>

            <div className="flex flex-wrap gap-2 md:col-span-4">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ titulo: "", descricao: "", prazo_em: "", client_id: "", status: "pendente" });
                  }}
                >
                  Cancelar edição
                </Button>
              ) : null}
            </div>

            {create.isError ? (
              <p className="text-sm text-destructive">{(create.error as any)?.response?.data?.detail ?? "Erro ao salvar tarefa"}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kanban simples</CardTitle>
        </CardHeader>
        <CardContent>
        {list.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : null}
        {list.data ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {["pendente", "em_andamento", "concluido"].map((col) => (
              <div key={col} className="rounded-lg border border-border/15 bg-card/20 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">{col}</div>
                  <Badge variant="secondary">{list.data.filter((t) => t.status === col).length}</Badge>
                </div>
                <div className="mt-2 space-y-2">
                  {list.data
                    .filter((t) => t.status === col)
                    .map((t) => (
                      <div key={t.id} className="space-y-2 rounded-lg border border-border/15 bg-card/40 p-3 text-sm">
                        <div className="font-medium">{t.titulo}</div>
                        {t.client_id ? (
                          <div className="text-xs text-muted-foreground">
                            Cliente: {clients.data?.find((c) => c.id === t.client_id)?.nome ?? t.client_id}
                          </div>
                        ) : null}
                        {t.descricao ? <div className="text-xs text-muted-foreground">{t.descricao}</div> : null}
                        {t.prazo_em ? <div className="text-xs text-muted-foreground">Prazo: {formatDateTimeBR(t.prazo_em)}</div> : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingId(t.id);
                              const prazo = t.prazo_em ? new Date(t.prazo_em) : null;
                              const prazoLocal = prazo
                                ? new Date(prazo.getTime() - prazo.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                                : "";
                              form.reset({
                                titulo: t.titulo,
                                descricao: t.descricao ?? "",
                                prazo_em: prazoLocal,
                                client_id: t.client_id ?? "",
                                status: t.status as any
                              });
                            }}
                          >
                            Editar
                          </Button>

                          <Select
                            className="h-9 w-[160px]"
                            value={t.status}
                            onChange={(e) => update.mutate({ id: t.id, patch: { status: e.target.value as any } })}
                          >
                            <option value="pendente">pendente</option>
                            <option value="em_andamento">em andamento</option>
                            <option value="concluido">concluído</option>
                          </Select>

                          <Button
                            size="sm"
                            variant="destructive"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(t.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {list.isError ? (
          <p className="mt-2 text-sm text-destructive">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar tarefas"}</p>
        ) : null}
        {update.isError ? (
          <p className="mt-2 text-sm text-destructive">{(update.error as any)?.response?.data?.detail ?? "Erro ao atualizar tarefa"}</p>
        ) : null}
        {remove.isError ? (
          <p className="mt-2 text-sm text-destructive">{(remove.error as any)?.response?.data?.detail ?? "Erro ao excluir tarefa"}</p>
        ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
