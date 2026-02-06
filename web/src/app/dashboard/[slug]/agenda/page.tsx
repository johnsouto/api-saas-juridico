"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeBR } from "@/lib/format";

type Client = { id: string; nome: string };
type Evento = {
  id: string;
  titulo: string;
  tipo: string;
  inicio_em: string;
  fim_em?: string | null;
  client_id?: string | null;
};

const schema = z.object({
  titulo: z.string().min(2),
  tipo: z.string().min(2).default("reuniao"),
  client_id: z.string().uuid().optional().or(z.literal("")),
  inicio_em: z.string().min(8),
  fim_em: z.string().optional()
});
type FormValues = z.infer<typeof schema>;

function toIsoOrThrow(value: string, label: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${label} inválida`);
  }
  return d.toISOString();
}

export default function AgendaPage() {
  const qc = useQueryClient();

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });

  const list = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => (await api.get<Evento[]>("/v1/agenda")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titulo: "", tipo: "reuniao", client_id: "", inicio_em: "", fim_em: "" }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const inicioIso = toIsoOrThrow(values.inicio_em, "Data/hora de início");
      const fimIso = values.fim_em ? toIsoOrThrow(values.fim_em, "Data/hora de fim") : null;
      return (
        await api.post("/v1/agenda", {
          ...values,
          client_id: values.client_id ? values.client_id : null,
          inicio_em: inicioIso,
          fim_em: fimIso
        })
      ).data;
    },
    onSuccess: async () => {
      form.reset({ titulo: "", tipo: "reuniao", client_id: "", inicio_em: "", fim_em: "" });
      await qc.invalidateQueries({ queryKey: ["agenda"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/agenda/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agenda"] });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
          <CardDescription>Eventos (audiências/reuniões) com data/hora sem digitar ISO.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo evento</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-2">
              <Label>Atalho (tipo de evento)</Label>
              <Select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (v === "reuniao_interna") {
                    form.setValue("tipo", "reuniao_interna");
                    form.setValue("titulo", "Reunião interna");
                  } else if (v === "video_conferencia") {
                    form.setValue("tipo", "video_conferencia");
                    form.setValue("titulo", "Video-conferência");
                  } else if (v === "video_novo_cliente") {
                    form.setValue("tipo", "video_novo_cliente");
                    form.setValue("titulo", "Vídeo com novo cliente");
                  }
                }}
              >
                <option value="">(opcional) Escolher</option>
                <option value="reuniao_interna">Reunião interna</option>
                <option value="video_conferencia">Video-conferência</option>
                <option value="video_novo_cliente">Vídeo com novo cliente</option>
              </Select>
              <p className="text-xs text-zinc-600">Atalhos fixos (separei do cliente para não poluir).</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Título</Label>
              <Input placeholder="Audiência / Reunião..." {...form.register("titulo")} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Cliente (opcional)</Label>
              <Select
                value={form.watch("client_id") ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  form.setValue("client_id", id, { shouldValidate: true });
                  if (id) {
                    const c = clients.data?.find((x) => x.id === id);
                    if (c) {
                      form.setValue("titulo", `Reunião com ${c.nome}`);
                    }
                  }
                }}
              >
                <option value="">(sem cliente)</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select {...form.register("tipo")}>
                <option value="reuniao">Reunião</option>
                <option value="audiencia">Audiência</option>
                <option value="reuniao_interna">Reunião interna</option>
                <option value="video_conferencia">Video-conferência</option>
                <option value="video_novo_cliente">Vídeo com novo cliente</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 md:col-span-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Início</Label>
                <Input className="min-w-[260px]" type="datetime-local" {...form.register("inicio_em")} />
              </div>
              <div className="space-y-1">
                <Label>Fim (opcional)</Label>
                <Input className="min-w-[260px]" type="datetime-local" {...form.register("fim_em")} />
              </div>
            </div>

            <div className="flex items-end">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>

          {create.isError ? (
            <p className="mt-3 text-sm text-red-600">
              {(create.error as any)?.response?.data?.detail ?? (create.error as Error).message ?? "Erro ao criar evento"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <p className="mt-2 text-sm text-zinc-600">Carregando…</p> : null}
          {list.data ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.titulo}</TableCell>
                      <TableCell>{e.tipo}</TableCell>
                      <TableCell>{e.client_id ? clients.data?.find((c) => c.id === e.client_id)?.nome ?? "—" : "—"}</TableCell>
                      <TableCell>{formatDateTimeBR(e.inicio_em) || e.inicio_em}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(e.id)}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {list.isError ? (
            <p className="mt-2 text-sm text-red-600">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar eventos"}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
