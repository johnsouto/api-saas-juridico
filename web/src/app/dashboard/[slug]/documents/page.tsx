"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Doc = {
  id: string;
  filename: string;
  size_bytes: number;
  categoria?: string | null;
  process_id?: string | null;
  client_id?: string | null;
  honorario_id?: string | null;
};
type Proc = { id: string; numero: string };
type Client = { id: string; nome: string };
type Honorario = { id: string; client_id: string; process_id?: string | null; status: string };
type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  is_plus_effective: boolean;
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [linkType, setLinkType] = useState<"none" | "process" | "client" | "honorario">("none");
  const [processId, setProcessId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [honorarioId, setHonorarioId] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("outros");
  const [file, setFile] = useState<File | null>(null);

  const processes = useQuery({
    queryKey: ["processes"],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes")).data
  });

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });

  const honorarios = useQuery({
    queryKey: ["honorarios"],
    queryFn: async () => (await api.get<Honorario[]>("/v1/honorarios")).data
  });

  const [filterType, setFilterType] = useState<"all" | "process" | "client" | "honorario">("all");
  const [filterId, setFilterId] = useState<string>("");
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const billing = useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    retry: false
  });

  const isFreePlan = billing.isSuccess && billing.data.plan_code === "FREE" && !billing.data.is_plus_effective;

  const list = useQuery({
    queryKey: ["documents", filterType, filterId, filterCategoria, q],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (filterCategoria) params.categoria = filterCategoria;
      if (filterType === "process" && filterId) params.process_id = filterId;
      if (filterType === "client" && filterId) params.client_id = filterId;
      if (filterType === "honorario" && filterId) params.honorario_id = filterId;
      return (await api.get<Doc[]>("/v1/documents", { params })).data;
    }
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");
      const fd = new FormData();
      fd.append("file", file);
      if (categoria) fd.append("categoria", categoria);
      if (linkType === "process" && processId) fd.append("process_id", processId);
      if (linkType === "client" && clientId) fd.append("client_id", clientId);
      if (linkType === "honorario" && honorarioId) fd.append("honorario_id", honorarioId);
      const r = await api.post<Doc>("/v1/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return r.data;
    },
    onSuccess: async () => {
      setFile(null);
      setProcessId("");
      setClientId("");
      setHonorarioId("");
      await qc.invalidateQueries({ queryKey: ["documents"] });
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
      // Open a window synchronously to avoid popup blockers, then set its URL after the blob is ready.
      const w = window.open("about:blank", "_blank", "noopener,noreferrer");
      const r = await api.get(`/v1/documents/${doc.id}/content`, {
        params: { disposition: "inline" },
        responseType: "blob"
      });
      const blob = r.data as Blob;
      const url = window.URL.createObjectURL(blob);

      if (w) {
        w.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      // Give the browser some time to load the blob URL before revoking it.
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    }
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/v1/documents/${documentId}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["documents"] });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isFreePlan ? (
            <p className="text-sm text-muted-foreground">Armazene e organize seus PDFs. Limite do plano Free: 100 MB.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Armazene e organize seus PDFs com segurança.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="outros">outros</option>
                <option value="identidade">identidade</option>
                <option value="comprovante_endereco">comprovante_endereco</option>
                <option value="declaracao_pobreza">declaracao_pobreza</option>
                <option value="contrato">contrato</option>
                <option value="peticao">peticao</option>
                <option value="procuracao">procuracao</option>
                <option value="comprovante_pagamento">comprovante_pagamento</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Vínculo</Label>
              <Select
                value={linkType}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setLinkType(v);
                  setProcessId("");
                  setClientId("");
                  setHonorarioId("");
                }}
              >
                <option value="none">sem vínculo</option>
                <option value="process">processo</option>
                <option value="client">cliente</option>
                <option value="honorario">honorário</option>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {linkType === "process" ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Processo</Label>
                <Select value={processId} onChange={(e) => setProcessId(e.target.value)}>
                  <option value="">Selecione o processo</option>
                  {processes.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {linkType === "client" ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Cliente</Label>
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Selecione o cliente</option>
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {linkType === "honorario" ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Honorário</Label>
                <Select value={honorarioId} onChange={(e) => setHonorarioId(e.target.value)}>
                  <option value="">Selecione o honorário</option>
                  {honorarios.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.id.slice(0, 8)}… ({h.status})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="flex items-end">
              <Button disabled={upload.isPending} onClick={() => upload.mutate()} type="button">
                {upload.isPending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>

          {upload.isError ? (
            <p className="mt-2 text-sm text-destructive">
              {(upload.error as any)?.response?.data?.detail ?? (upload.error as Error).message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Buscar por nome do arquivo</Label>
            <Input placeholder="ex: contrato, procuração..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Filtro</Label>
            <Select
              value={filterType}
              onChange={(e) => {
                const v = e.target.value as any;
                setFilterType(v);
                setFilterId("");
              }}
            >
              <option value="all">todos</option>
              <option value="process">processo</option>
              <option value="client">cliente</option>
              <option value="honorario">honorário</option>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Categoria</Label>
            <Input placeholder="ex: identidade" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>ID</Label>
            <Input
              placeholder={filterType === "all" ? "(opcional)" : "uuid"}
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              disabled={filterType === "all"}
            />
            {filterType !== "all" ? (
              <div className="mt-2">
                <Select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
                  <option value="">Selecionar…</option>
                  {filterType === "process"
                    ? processes.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.numero}
                        </option>
                      ))
                    : null}
                  {filterType === "client"
                    ? clients.data?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))
                    : null}
                  {filterType === "honorario"
                    ? honorarios.data?.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.id.slice(0, 8)}… ({h.status})
                        </option>
                      ))
                    : null}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Dica: use o seletor acima para evitar erro de UUID.</p>
              </div>
            ) : null}
          </div>
        </div>

        {list.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : null}
        {list.data ? (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.filename}</TableCell>
                    <TableCell>{d.categoria ?? "—"}</TableCell>
                    <TableCell>
                      {d.process_id ? "processo" : d.client_id ? "cliente" : d.honorario_id ? "honorário" : "—"}
                    </TableCell>
                    <TableCell>{Math.round(d.size_bytes / 1024)} KB</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => view.mutate(d)} type="button" disabled={view.isPending}>
                          Visualizar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => download.mutate(d)} type="button" disabled={download.isPending}>
                          {download.isPending ? "Baixando..." : "Baixar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => remove.mutate(d.id)}
                          disabled={remove.isPending}
                          type="button"
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
          <p className="mt-2 text-sm text-destructive">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar documentos"}</p>
        ) : null}
        {view.isError ? (
          <p className="mt-2 text-sm text-destructive">{(view.error as any)?.response?.data?.detail ?? "Erro ao visualizar documento"}</p>
        ) : null}
        {download.isError ? (
          <p className="mt-2 text-sm text-destructive">{(download.error as any)?.response?.data?.detail ?? "Erro ao baixar documento"}</p>
        ) : null}
        {remove.isError ? (
          <p className="mt-2 text-sm text-destructive">{(remove.error as any)?.response?.data?.detail ?? "Erro ao excluir documento"}</p>
        ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
