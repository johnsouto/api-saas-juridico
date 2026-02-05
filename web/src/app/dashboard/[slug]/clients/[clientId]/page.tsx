"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { id: string; nome: string; cpf: string; dados_contato?: any };
type Proc = { id: string; numero: string; status: string };
type Doc = { id: string; filename: string; size_bytes: number; categoria?: string | null; criado_em: string };

const CATEGORIAS = [
  { value: "identidade", label: "Identidade (RG/CPF)" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
  { value: "declaracao_pobreza", label: "Declaração de Pobreza" },
  { value: "outros", label: "Outros" }
];

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string; slug: string }>();
  const qc = useQueryClient();
  const clientId = params.clientId;

  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0].value);
  const [file, setFile] = useState<File | null>(null);

  const client = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => (await api.get<Client>(`/v1/clients/${clientId}`)).data
  });

  const processes = useQuery({
    queryKey: ["processes", "client", clientId],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes", { params: { client_id: clientId } })).data
  });

  const documents = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => (await api.get<Doc[]>(`/v1/clients/${clientId}/documents`)).data
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categoria", categoria);
      const r = await api.post<Doc>(`/v1/clients/${clientId}/documents/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return r.data;
    },
    onSuccess: async () => {
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    }
  });

  const download = useMutation({
    mutationFn: async (documentId: string) => {
      const r = await api.get<{ url: string }>(`/v1/documents/${documentId}/download`);
      return r.data.url;
    },
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/v1/documents/${documentId}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    }
  });

  const docsByCategoria = useMemo(() => {
    const list = documents.data ?? [];
    const groups: Record<string, Doc[]> = {};
    for (const d of list) {
      const key = d.categoria ?? "sem_categoria";
      groups[key] = groups[key] ?? [];
      groups[key].push(d);
    }
    return groups;
  }, [documents.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{client.data?.nome ?? "Cliente"}</CardTitle>
              <CardDescription>CPF: {client.data?.cpf}</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="../">Voltar</Link>
            </Button>
          </div>
          {client.isError ? (
            <p className="text-sm text-red-600">
              {(client.error as any)?.response?.data?.detail ?? "Erro ao carregar cliente"}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos do cliente</CardTitle>
          <CardDescription>PDF/JPEG (identidade, comprovante de endereço etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Arquivo</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex items-end">
              <Button type="button" disabled={upload.isPending} onClick={() => upload.mutate()}>
                {upload.isPending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>

          {upload.isError ? (
            <p className="mt-3 text-sm text-red-600">
              {(upload.error as any)?.response?.data?.detail ?? (upload.error as Error).message}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {documents.isLoading ? <p className="text-sm text-zinc-600">Carregando documentos…</p> : null}
            {Object.keys(docsByCategoria).length === 0 && documents.isSuccess ? (
              <p className="text-sm text-zinc-600">Nenhum documento ainda.</p>
            ) : null}

            {Object.entries(docsByCategoria).map(([cat, docs]) => (
              <div key={cat} className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-zinc-600">
                  {CATEGORIAS.find((c) => c.value === cat)?.label ?? cat}
                </div>
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.filename}</TableCell>
                          <TableCell>{Math.round(d.size_bytes / 1024)} KB</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" type="button" onClick={() => download.mutate(d.id)}>
                                Baixar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => remove.mutate(d.id)}
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processos deste cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {processes.isLoading ? <p className="text-sm text-zinc-600">Carregando processos…</p> : null}
          {processes.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processes.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.numero}</TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : processes.isSuccess ? (
            <p className="text-sm text-zinc-600">Nenhum processo cadastrado para este cliente.</p>
          ) : null}
          {processes.isError ? (
            <p className="mt-2 text-sm text-red-600">
              {(processes.error as any)?.response?.data?.detail ?? "Erro ao carregar processos"}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
