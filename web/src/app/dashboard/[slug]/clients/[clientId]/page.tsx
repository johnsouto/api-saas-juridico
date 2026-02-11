"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
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

type Parceria = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  criado_em: string;
};

type Proc = { id: string; numero: string; status: string };

type Doc = {
  id: string;
  filename: string;
  size_bytes: number;
  categoria?: string | null;
  mime_type?: string | null;
  criado_em: string;
};

type ClientDetails = {
  client: Client;
  parcerias: Parceria[];
  documents: Doc[];
};

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

  const details = useQuery({
    queryKey: ["client-details", clientId],
    queryFn: async () => (await api.get<ClientDetails>(`/v1/clients/${clientId}/details`)).data
  });

  const processes = useQuery({
    queryKey: ["processes", "client", clientId],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes", { params: { client_id: clientId } })).data
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
      await qc.invalidateQueries({ queryKey: ["client-details", clientId] });
    }
  });

  const download = useMutation({
    mutationFn: async (doc: Doc) => {
      const r = await api.get(`/v1/documents/${doc.id}/content`, {
        params: { disposition: "attachment" },
        responseType: "blob"
      });
      const blob = r.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename || "arquivo";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  });

  const view = useMutation({
    mutationFn: async (doc: Doc) => {
      const w = window.open("about:blank", "_blank", "noopener,noreferrer");
      const r = await api.get(`/v1/documents/${doc.id}/content`, {
        params: { disposition: "inline" },
        responseType: "blob"
      });
      const blob = r.data as Blob;
      const url = window.URL.createObjectURL(blob);

      if (w) w.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");

      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    }
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/v1/documents/${documentId}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["client-details", clientId] });
    }
  });

  const client = details.data?.client;
  const parcerias = details.data?.parcerias ?? [];
  const documents = details.data?.documents ?? [];

  const docsByCategoria = useMemo(() => {
    const groups: Record<string, Doc[]> = {};
    for (const d of documents) {
      const key = d.categoria ?? "sem_categoria";
      groups[key] = groups[key] ?? [];
      groups[key].push(d);
    }
    return groups;
  }, [documents]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Cliente: {client?.nome ?? "—"}</CardTitle>
              <CardDescription>
                {client ? `${client.tipo_documento.toUpperCase()}: ${client.documento}` : "Carregando…"}
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="../">Voltar</Link>
            </Button>
          </div>
          {details.isError ? (
            <p className="text-sm text-destructive">Erro ao carregar cliente.</p>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {details.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {client ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoItem label="Nome" value={client.nome} />
              <InfoItem label="Documento" value={`${client.tipo_documento.toUpperCase()} ${client.documento}`} />
              <InfoItem label="E-mail" value={client.email ?? null} />
              <InfoItem label="Celular" value={client.phone_mobile ?? null} />
              <InfoItem label="Rua" value={client.address_street ?? null} />
              <InfoItem label="Número" value={client.address_number ?? null} />
              <InfoItem label="Complemento" value={client.address_complement ?? null} />
              <InfoItem label="Bairro" value={client.address_neighborhood ?? null} />
              <InfoItem label="Cidade" value={client.address_city ?? null} />
              <InfoItem label="UF" value={client.address_state ?? null} />
              <InfoItem label="CEP" value={client.address_zip ?? null} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parcerias relacionadas</CardTitle>
          <CardDescription>Parcerias vinculadas a processos deste cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {details.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {parcerias.length === 0 && details.isSuccess ? (
            <p className="text-sm text-muted-foreground">Nenhuma parceria vinculada a este cliente.</p>
          ) : null}
          {parcerias.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcerias.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <span>{p.nome}</span>
                          <CopyButton value={p.nome} label="Copiar nome" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.email ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{p.email}</span>
                            <CopyButton value={p.email} label="Copiar e-mail" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.telefone ? (
                          <div className="flex items-center justify-between gap-2">
                            <span>{p.telefone}</span>
                            <CopyButton value={p.telefone} label="Copiar telefone" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.oab_number ? (
                          <div className="flex items-center justify-between gap-2">
                            <span>{p.oab_number}</span>
                            <CopyButton value={p.oab_number} label="Copiar OAB" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {p.tipo_documento}:{p.documento}
                          </span>
                          <CopyButton value={p.documento} label="Copiar documento" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Arquivo (PDF/JPEG)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
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
            <div className="flex items-end justify-end">
              <Button type="button" disabled={upload.isPending} onClick={() => upload.mutate()}>
                {upload.isPending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>

          {upload.isError ? (
            <p className="mt-3 text-sm text-destructive">Não foi possível enviar o documento.</p>
          ) : null}
          {view.isError ? (
            <p className="mt-3 text-sm text-destructive">Erro ao visualizar documento.</p>
          ) : null}
          {download.isError ? (
            <p className="mt-3 text-sm text-destructive">Erro ao baixar documento.</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {details.isLoading ? <p className="text-sm text-muted-foreground">Carregando documentos…</p> : null}
            {Object.keys(docsByCategoria).length === 0 && details.isSuccess ? (
              <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>
            ) : null}

            {Object.entries(docsByCategoria).map(([cat, docs]) => (
              <div key={cat} className="rounded-lg border border-border/15 bg-card/20 p-3 backdrop-blur">
                <div className="text-xs font-semibold text-muted-foreground">
                  {CATEGORIAS.find((c) => c.value === cat)?.label ?? cat}
                </div>
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.filename}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTimeBR(d.criado_em)}</TableCell>
                          <TableCell>{Math.round(d.size_bytes / 1024)} KB</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => view.mutate(d)}
                                disabled={view.isPending}
                              >
                                Visualizar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => download.mutate(d)}
                                disabled={download.isPending}
                              >
                                {download.isPending ? "Baixando..." : "Baixar"}
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
          {processes.isLoading ? <p className="text-sm text-muted-foreground">Carregando processos…</p> : null}
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
            <p className="text-sm text-muted-foreground">Nenhum processo cadastrado para este cliente.</p>
          ) : null}
          {processes.isError ? (
            <p className="mt-2 text-sm text-destructive">Erro ao carregar processos.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-sm">{value ?? "—"}</div>
      </div>
      {value ? <CopyButton value={value} label={`Copiar ${label}`} /> : null}
    </div>
  );
}
