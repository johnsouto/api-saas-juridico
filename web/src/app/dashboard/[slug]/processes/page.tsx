"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";

type Client = { id: string; nome: string };
type Parceria = { id: string; nome: string };
type Proc = {
  id: string;
  numero: string;
  status: "ativo" | "inativo" | "outros";
  nicho?: string | null;
  client_id: string;
  client_nome?: string | null;
  parceria_id?: string | null;
};

const schema = z.object({
  client_id: z.string().uuid("Selecione um cliente."),
  parceria_id: z.string().uuid().optional().or(z.literal("")),
  numero: z.string().min(3, "Informe o número do processo."),
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
  const { toast } = useToast();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");
  const [clientFilterId, setClientFilterId] = useState<string>("");
  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });

  const parcerias = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => (await api.get<Parceria[]>("/v1/parcerias")).data
  });

  const list = useQuery({
    queryKey: ["processes", q, clientFilterId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (clientFilterId) params.client_id = clientFilterId;
      return (await api.get<Proc[]>("/v1/processes", { params })).data;
    }
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
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      form.reset({ client_id: "", parceria_id: "", numero: "", status: "ativo", nicho: "" });
      await qc.invalidateQueries({ queryKey: ["processes"] });
      toast(wasEditing ? "Processo atualizado com sucesso." : "Processo cadastrado com sucesso.", {
        variant: "success"
      });
    },
    onError: () => {
      toast("Não foi possível salvar o processo. Tente novamente.", { variant: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/processes/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["processes"] });
      toast("Processo excluído.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível excluir o processo. Tente novamente.", { variant: "error" });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Processos</CardTitle>
          <CardDescription>Busca por Processo / Nicho + Cadastre seu processo</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editingId ? "Editar processo" : "Novo processo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1">
              <Label htmlFor="processo_cliente">Cliente *</Label>
              <Select id="processo_cliente" {...form.register("client_id")}>
                <option value="">Selecione o cliente</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
              {form.formState.errors.client_id ? (
                <p className="text-xs text-destructive">{form.formState.errors.client_id.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="processo_parceria">Parceria (opcional)</Label>
              <Select id="processo_parceria" {...form.register("parceria_id")}>
                <option value="">Sem parceria</option>
                {parcerias.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="processo_numero">Número *</Label>
              <Input id="processo_numero" placeholder="Ex: 0001234-56.2025.8.26.0000" {...form.register("numero")} />
              {form.formState.errors.numero ? (
                <p className="text-xs text-destructive">{form.formState.errors.numero.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="processo_status">Status *</Label>
              <Select id="processo_status" {...form.register("status")}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="outros">Outros</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="processo_nicho">Nicho (opcional)</Label>
              <Select id="processo_nicho" {...form.register("nicho")}>
                <option value="">Selecione um nicho</option>
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

          {create.isError ? <p className="mt-2 text-sm text-destructive">Não foi possível salvar o processo.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input
              className="md:col-span-2"
              placeholder="Buscar por processo ou nicho…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={clientFilterId} onChange={(e) => setClientFilterId(e.target.value)}>
              <option value="">Filtrar por cliente</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Button variant="outline" type="button" onClick={() => setQ("")}>
              Limpar
            </Button>
          </div>

        {list.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : null}
        {list.data && list.data.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border/20 bg-card/40 p-6 text-sm text-muted-foreground">
            <p>Nenhum processo cadastrado ainda.</p>
            <Button
              className="mt-3"
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Cadastrar primeiro processo
            </Button>
          </div>
        ) : null}
        {list.data && list.data.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
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
                    <TableCell>{p.client_nome ?? clients.data?.find((c) => c.id === p.client_id)?.nome ?? "—"}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{p.nicho ?? "—"}</TableCell>
                    <TableCell>
                      {p.parceria_id ? parcerias.data?.find((x) => x.id === p.parceria_id)?.nome ?? "—" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/${slug}/documents?process_id=${p.id}&category=despacho`}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Despacho
                          </Link>
                        </Button>
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
        {list.isError ? <p className="mt-2 text-sm text-destructive">Erro ao listar processos.</p> : null}
        {remove.isError ? <p className="mt-2 text-sm text-destructive">Erro ao excluir processo.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
