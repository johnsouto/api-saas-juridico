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
import { formatDateTimeBR } from "@/lib/datetime";
import { useToast } from "@/components/ui/toast";

type Client = { id: string; nome: string };
type Tarefa = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  prazo_em?: string | null;
  client_id?: string | null;
  related_process_id?: string | null;
  attachment_document_id?: string | null;
  source?: string | null;
  attachment_is_temporary?: boolean;
};

const schema = z.object({
  titulo: z.string().min(2, "Informe o título da tarefa."),
  descricao: z.string().optional(),
  prazo_em: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: "Prazo inválido." }),
  client_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["pendente", "em_andamento", "concluido"]).default("pendente")
});
type FormValues = z.infer<typeof schema>;

const KANBAN_STATUS_LABEL: Record<string, string> = {
  pendente: "pendente",
  em_andamento: "em andamento",
  concluido: "concluído"
};

export default function TarefasPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
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
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      form.reset({ titulo: "", descricao: "", prazo_em: "", client_id: "", status: "pendente" });
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
      toast(wasEditing ? "Tarefa atualizada com sucesso." : "Tarefa criada com sucesso.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível salvar a tarefa. Tente novamente.", { variant: "error" });
    }
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tarefa> }) => {
      await api.put(`/v1/tarefas/${id}`, patch);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
      toast("Status atualizado.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível atualizar a tarefa. Tente novamente.", { variant: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await api.delete<{ message: string; temporary_attachment_removed?: boolean }>(`/v1/tarefas/${id}`);
      return r.data;
    },
    onSuccess: async (payload) => {
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
      const withCleanup = payload?.temporary_attachment_removed;
      if (withCleanup) {
        toast("Tarefa excluída. O anexo temporário também foi removido para economizar armazenamento.", { variant: "success" });
      } else {
        toast("Tarefa excluída.", { variant: "success" });
      }
    },
    onError: () => {
      toast("Não foi possível excluir a tarefa. Tente novamente.", { variant: "error" });
    }
  });
  const downloadAttachment = useMutation({
    mutationFn: async ({ documentId, title }: { documentId: string; title: string }) => {
      const r = await api.get(`/v1/documents/${documentId}/content`, {
        params: { disposition: "attachment" },
        responseType: "blob"
      });
      const blob = r.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "movimentacao"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: () => {
      toast("Não foi possível baixar o anexo da tarefa.", { variant: "error" });
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
              <Label htmlFor="tarefa_titulo">Título *</Label>
              <Input id="tarefa_titulo" placeholder="Ex: Revisar contrato" {...form.register("titulo")} />
              {form.formState.errors.titulo ? (
                <p className="text-xs text-destructive">{form.formState.errors.titulo.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="tarefa_cliente">Cliente (opcional)</Label>
              <Select id="tarefa_cliente" {...form.register("client_id")}>
                <option value="">(sem cliente)</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tarefa_status">Status *</Label>
              <Select id="tarefa_status" {...form.register("status")}>
                <option value="pendente">pendente</option>
                <option value="em_andamento">em andamento</option>
                <option value="concluido">concluído</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tarefa_prazo">Prazo (opcional)</Label>
              <Input id="tarefa_prazo" className="min-w-[260px]" type="datetime-local" {...form.register("prazo_em")} />
              {form.formState.errors.prazo_em ? (
                <p className="text-xs text-destructive">{form.formState.errors.prazo_em.message}</p>
              ) : null}
            </div>

            <div className="space-y-1 md:col-span-4">
              <Label htmlFor="tarefa_descricao">Descrição (opcional)</Label>
              <Textarea id="tarefa_descricao" placeholder="Detalhes da tarefa" {...form.register("descricao")} />
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

            {create.isError ? <p className="text-sm text-destructive">Não foi possível salvar a tarefa.</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kanban simples</CardTitle>
        </CardHeader>
        <CardContent>
        {list.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : null}
        {list.data && list.data.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border/20 bg-card/40 p-6 text-sm text-muted-foreground">
            <p>Nenhuma tarefa cadastrada ainda.</p>
            <Button
              className="mt-3"
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Criar primeira tarefa
            </Button>
          </div>
        ) : null}
        {list.data && list.data.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {["pendente", "em_andamento", "concluido"].map((col) => (
              <div key={col} className="rounded-lg border border-border/15 bg-card/20 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {KANBAN_STATUS_LABEL[col] ?? col}
                  </div>
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
                        {t.attachment_document_id ? (
                          <div className="rounded-md border border-border/20 bg-card/30 p-2 text-xs">
                            <div className="font-medium text-muted-foreground">Anexo</div>
                            <Button
                              className="mt-2 w-full"
                              size="sm"
                              variant="outline"
                              type="button"
                              disabled={downloadAttachment.isPending}
                              onClick={() =>
                                downloadAttachment.mutate({
                                  documentId: t.attachment_document_id as string,
                                  title: t.titulo
                                })
                              }
                            >
                              {downloadAttachment.isPending ? "Baixando..." : "Baixar anexo"}
                            </Button>
                          </div>
                        ) : null}

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
        {list.isError ? <p className="mt-2 text-sm text-destructive">Erro ao listar tarefas.</p> : null}
        {update.isError ? <p className="mt-2 text-sm text-destructive">Erro ao atualizar tarefa.</p> : null}
        {remove.isError ? <p className="mt-2 text-sm text-destructive">Erro ao excluir tarefa.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
