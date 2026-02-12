"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, ExternalLink, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { formatFullAddress } from "@/lib/address";
import { formatDateTimeBR } from "@/lib/datetime";
import { formatCNPJ, formatCPF, formatPhoneBR, formatProcessCNJ } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

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
  oab_uf?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  criado_em: string;
};

type Proc = {
  id: string;
  numero: string;
  status: string;
  tribunal_code?: string | null;
  tribunal_login_url?: string | null;
};
type ClientCase = {
  id: string;
  title?: string | null;
  content: string;
  criado_em: string;
};
type LastMovementStatus = {
  can_create: boolean;
  blocking_task_id?: string;
  blocking_task_title?: string;
  blocking_due_at?: string;
};
type LastMovementStatusMap = Record<string, LastMovementStatus>;
type LastMovementCreateResponse = {
  ok: boolean;
  movement: { id: string };
  task: { id: string };
};
type ClientCasePayload = { title: string | null; content: string };

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
  { value: "despacho", label: "Despacho" },
  { value: "sentencas", label: "Sentenças" },
  { value: "acordao", label: "Acordão" },
  { value: "identidade", label: "Identidade (RG/CPF)" },
  { value: "comprovante_endereco", label: "Comprovante de Endereço" },
  { value: "declaracao_pobreza", label: "Declaração de Pobreza" },
  { value: "outros", label: "Outros" }
];

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string; slug: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const clientId = params.clientId;
  const slug = params.slug;

  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementProcess, setMovementProcess] = useState<Proc | null>(null);
  const [movementFile, setMovementFile] = useState<File | null>(null);
  const [movementTitle, setMovementTitle] = useState("");
  const [movementDate, setMovementDate] = useState("");
  const [movementTime, setMovementTime] = useState("");
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementConflict, setMovementConflict] = useState<string | null>(null);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseDeleteOpen, setCaseDeleteOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<ClientCase | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<ClientCase | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseContent, setCaseContent] = useState("");
  const [caseError, setCaseError] = useState<string | null>(null);
  const [selectedCaseProcessId, setSelectedCaseProcessId] = useState<string>("");

  const details = useQuery({
    queryKey: ["client-details", clientId],
    queryFn: async () => (await api.get<ClientDetails>(`/v1/clients/${clientId}/details`)).data
  });

  const clientCases = useQuery({
    queryKey: ["client-cases", clientId],
    queryFn: async () => (await api.get<ClientCase[]>(`/v1/clients/${clientId}/cases`)).data
  });

  const processes = useQuery({
    queryKey: ["processes", "client", clientId],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes", { params: { client_id: clientId } })).data
  });
  const processIdsKey = useMemo(() => (processes.data ?? []).map((item) => item.id).join(","), [processes.data]);
  const processLastMovementStatus = useQuery({
    queryKey: ["process-last-movement-status", clientId, processIdsKey],
    enabled: Boolean(processIdsKey),
    queryFn: async () => {
      const items = processes.data ?? [];
      const entries = await Promise.all(
        items.map(async (proc) => {
          const resp = await api.get<LastMovementStatus>(`/v1/processes/${proc.id}/last-movement/status`);
          return [proc.id, resp.data] as const;
        })
      );
      return Object.fromEntries(entries) as LastMovementStatusMap;
    }
  });

  useEffect(() => {
    if (!processes.data?.length) {
      setSelectedCaseProcessId("");
      return;
    }
    if (!selectedCaseProcessId || !processes.data.some((item) => item.id === selectedCaseProcessId)) {
      setSelectedCaseProcessId(processes.data[0].id);
    }
  }, [processes.data, selectedCaseProcessId]);

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
  const createLastMovement = useMutation({
    mutationFn: async (vars: {
      processId: string;
      title: string;
      dueAtIso: string;
      file: File;
    }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      fd.append("title", vars.title);
      fd.append("due_at", vars.dueAtIso);
      fd.append("client_id", clientId);
      const resp = await api.post<LastMovementCreateResponse>(`/v1/processes/${vars.processId}/last-movement`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return resp.data;
    },
    onSuccess: async () => {
      toast("Movimentação registrada e tarefa criada no Kanban.", { variant: "success" });
      setMovementOpen(false);
      setMovementProcess(null);
      setMovementFile(null);
      setMovementTitle("");
      setMovementDate("");
      setMovementTime("");
      setMovementError(null);
      setMovementConflict(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["process-last-movement-status", clientId] }),
        qc.invalidateQueries({ queryKey: ["kanban-summary"] }),
        qc.invalidateQueries({ queryKey: ["tarefas"] })
      ]);
    },
    onError: (error: any) => {
      const statusCode = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const code = typeof detail === "object" && detail !== null ? detail.code : undefined;
      const message =
        typeof detail === "object" && detail !== null && typeof detail.message === "string"
          ? detail.message
          : typeof detail === "string"
            ? detail
            : "Não foi possível criar a tarefa da movimentação.";

      if (statusCode === 409 || code === "PREVIOUS_TASK_NOT_COMPLETED") {
        setMovementConflict(message);
        setMovementError(null);
        toast(message, { variant: "error" });
        return;
      }

      setMovementConflict(null);
      setMovementError(message);
      toast(message, { variant: "error" });
    }
  });

  const saveCase = useMutation({
    mutationFn: async (payload: ClientCasePayload) => {
      if (editingCase) {
        const response = await api.patch<ClientCase>(`/v1/clients/${clientId}/cases/${editingCase.id}`, payload);
        return response.data;
      }
      const response = await api.post<ClientCase>(`/v1/clients/${clientId}/cases`, payload);
      return response.data;
    },
    onSuccess: async () => {
      setCaseModalOpen(false);
      setEditingCase(null);
      setCaseTitle("");
      setCaseContent("");
      setCaseError(null);
      await qc.invalidateQueries({ queryKey: ["client-cases", clientId] });
      toast(editingCase ? "Caso concreto atualizado." : "Caso concreto criado.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível salvar o caso concreto.", { variant: "error" });
    }
  });

  const deleteCase = useMutation({
    mutationFn: async (caseId: string) => {
      await api.delete(`/v1/clients/${clientId}/cases/${caseId}`);
    },
    onSuccess: async () => {
      setCaseDeleteOpen(false);
      setCaseToDelete(null);
      await qc.invalidateQueries({ queryKey: ["client-cases", clientId] });
      toast("Caso concreto removido.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível remover o caso concreto.", { variant: "error" });
    }
  });

  const client = details.data?.client;
  const parcerias = details.data?.parcerias ?? [];

  const docsByCategoria = useMemo(() => {
    const documents = details.data?.documents ?? [];
    const groups: Record<string, Doc[]> = {};
    for (const d of documents) {
      const key = d.categoria ?? "sem_categoria";
      groups[key] = groups[key] ?? [];
      groups[key].push(d);
    }
    return groups;
  }, [details.data?.documents]);

  const selectedCaseProcess = useMemo(() => {
    return (processes.data ?? []).find((item) => item.id === selectedCaseProcessId) ?? null;
  }, [processes.data, selectedCaseProcessId]);

  useEffect(() => {
    if (!movementOpen && !caseModalOpen && !caseDeleteOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (movementOpen && !createLastMovement.isPending) {
        setMovementOpen(false);
        setMovementProcess(null);
        setMovementFile(null);
        setMovementTitle("");
        setMovementDate("");
        setMovementTime("");
        setMovementError(null);
        setMovementConflict(null);
        return;
      }
      if (caseModalOpen && !saveCase.isPending) {
        setCaseModalOpen(false);
        setEditingCase(null);
        setCaseTitle("");
        setCaseContent("");
        setCaseError(null);
      }
      if (caseDeleteOpen && !deleteCase.isPending) {
        setCaseDeleteOpen(false);
        setCaseToDelete(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    caseDeleteOpen,
    caseModalOpen,
    createLastMovement.isPending,
    deleteCase.isPending,
    movementOpen,
    saveCase.isPending
  ]);

  function openMovementModal(processItem: Proc) {
    const defaults = getNowDateTimeFields();
    setMovementProcess(processItem);
    setMovementDate(defaults.date);
    setMovementTime(defaults.time);
    setMovementTitle("");
    setMovementFile(null);
    setMovementError(null);
    setMovementConflict(null);
    setMovementOpen(true);
  }

  function closeMovementModal() {
    setMovementOpen(false);
    setMovementProcess(null);
    setMovementFile(null);
    setMovementTitle("");
    setMovementDate("");
    setMovementTime("");
    setMovementError(null);
    setMovementConflict(null);
  }

  function submitLastMovement() {
    if (!movementProcess) return;
    if (!movementFile) {
      setMovementError("Selecione o arquivo da última movimentação.");
      setMovementConflict(null);
      return;
    }
    const cleanTitle = movementTitle.trim();
    if (cleanTitle.length < 2) {
      setMovementError("Informe um título válido para a tarefa.");
      setMovementConflict(null);
      return;
    }

    const dueAtIso = parsePtBrDateTimeToIso(movementDate, movementTime);
    if (!dueAtIso) {
      setMovementError("Prazo inválido. Use o formato dd/mm/aaaa e HH:mm.");
      setMovementConflict(null);
      return;
    }

    setMovementError(null);
    setMovementConflict(null);
    createLastMovement.mutate({
      processId: movementProcess.id,
      title: cleanTitle,
      dueAtIso,
      file: movementFile
    });
  }

  function openCreateCaseModal() {
    setEditingCase(null);
    setCaseTitle("");
    setCaseContent("");
    setCaseError(null);
    setCaseModalOpen(true);
  }

  function openEditCaseModal(item: ClientCase) {
    setEditingCase(item);
    setCaseTitle(item.title ?? "");
    setCaseContent(item.content);
    setCaseError(null);
    setCaseModalOpen(true);
  }

  function submitCase() {
    const content = caseContent.trim();
    if (content.length < 2) {
      setCaseError("Informe o conteúdo do caso concreto.");
      return;
    }
    setCaseError(null);
    saveCase.mutate({ title: caseTitle.trim() || null, content });
  }

  const movementHelpText =
    'Envie o documento da última movimentação do processo (ex.: despacho do EPROC), informe o prazo e criaremos uma tarefa no Kanban. Para adicionar uma nova movimentação deste processo, conclua a tarefa anterior e clique em "Excluir".';
  const blockingTooltip = "Conclua a tarefa anterior para registrar uma nova movimentação.";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Cliente: {client?.nome ?? "—"}</CardTitle>
              <CardDescription>
                {client
                  ? `${client.tipo_documento.toUpperCase()}: ${
                      client.tipo_documento === "cpf" ? formatCPF(client.documento) : formatCNPJ(client.documento)
                    }`
                  : "Carregando…"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="#caso-concreto">Caso concreto</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="../">Voltar</Link>
              </Button>
            </div>
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
              <InfoItem
                label="Documento"
                value={`${client.tipo_documento.toUpperCase()} ${
                  client.tipo_documento === "cpf" ? formatCPF(client.documento) : formatCNPJ(client.documento)
                }`}
              />
              <InfoItem label="E-mail" value={client.email ?? null} />
              <InfoItem label="Celular" value={client.phone_mobile ? formatPhoneBR(client.phone_mobile) : null} />
              {(() => {
                const fullAddress = formatFullAddress({
                  street: client.address_street,
                  number: client.address_number,
                  complement: client.address_complement,
                  neighborhood: client.address_neighborhood,
                  city: client.address_city,
                  state: client.address_state,
                  zip: client.address_zip
                });
                return <InfoItem label="Endereço completo" value={fullAddress === "-" ? null : fullAddress} />;
              })()}
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
                            <span>{formatPhoneBR(p.telefone)}</span>
                            <CopyButton value={formatPhoneBR(p.telefone)} label="Copiar telefone" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.oab_number ? (
                          <div className="flex items-center justify-between gap-2">
                            <span>{[p.oab_uf, p.oab_number].filter(Boolean).join(" ")}</span>
                            <CopyButton value={[p.oab_uf, p.oab_number].filter(Boolean).join(" ")} label="Copiar OAB" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {p.tipo_documento}:{p.tipo_documento === "cpf" ? formatCPF(p.documento) : formatCNPJ(p.documento)}
                          </span>
                          <CopyButton
                            value={p.tipo_documento === "cpf" ? formatCPF(p.documento) : formatCNPJ(p.documento)}
                            label="Copiar documento"
                          />
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

      <Card id="caso-concreto" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Caso concreto</CardTitle>
              <CardDescription>Registre os casos concretos deste cliente (múltiplos itens).</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Select
                value={selectedCaseProcessId}
                onChange={(event) => setSelectedCaseProcessId(event.target.value)}
                className="min-w-[220px]"
              >
                <option value="">Selecione o processo</option>
                {processes.data?.map((processItem) => (
                  <option key={processItem.id} value={processItem.id}>
                    {formatProcessCNJ(processItem.numero)}
                  </option>
                ))}
              </Select>
              <span
                title={
                  selectedCaseProcess?.tribunal_login_url
                    ? "Abrir login do tribunal"
                    : "Defina o link no cadastro do processo."
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedCaseProcess?.tribunal_login_url}
                  onClick={() => {
                    if (!selectedCaseProcess?.tribunal_login_url) return;
                    window.open(selectedCaseProcess.tribunal_login_url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Login Tribunal
                </Button>
              </span>
              <Button type="button" onClick={openCreateCaseModal}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar caso
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientCases.isLoading ? <p className="text-sm text-muted-foreground">Carregando casos…</p> : null}
          {clientCases.isError ? <p className="text-sm text-destructive">Erro ao carregar casos concretos.</p> : null}
          {clientCases.isSuccess && clientCases.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso concreto cadastrado.</p>
          ) : null}
          <div className="space-y-3">
            {clientCases.data?.map((caseItem, index) => (
              <div key={caseItem.id} className="rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Caso {index + 1}
                      {caseItem.title ? ` — ${caseItem.title}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{caseItem.content}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={() => openEditCaseModal(caseItem)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      type="button"
                      onClick={() => {
                        setCaseToDelete(caseItem);
                        setCaseDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                    <TableHead>Status do Processo</TableHead>
                    <TableHead className="w-[420px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processes.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{formatProcessCNJ(p.numero)}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span title={p.tribunal_login_url ? "Abrir login do tribunal" : "Defina o link no cadastro do processo."}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!p.tribunal_login_url}
                              onClick={() => {
                                if (!p.tribunal_login_url) return;
                                window.open(p.tribunal_login_url, "_blank", "noopener,noreferrer");
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Login Tribunal
                            </Button>
                          </span>
                          <span
                            title={
                              processLastMovementStatus.data?.[p.id]?.can_create === false
                                ? blockingTooltip
                                : "Registrar última movimentação"
                            }
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                createLastMovement.isPending ||
                                processLastMovementStatus.data?.[p.id]?.can_create === false
                              }
                              onClick={() => openMovementModal(p)}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Última Movimentação
                            </Button>
                          </span>

                          <button
                            type="button"
                            aria-label="Ajuda sobre última movimentação"
                            title={movementHelpText}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/20 bg-card/40 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <CircleHelp className="h-4 w-4" />
                          </button>
                        </div>
                        {processLastMovementStatus.data?.[p.id]?.can_create === false ? (
                          <p className="mt-1 text-right text-xs text-amber-500">{blockingTooltip}</p>
                        ) : null}
                      </TableCell>
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

      {caseModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <div
                aria-hidden="true"
                className="fixed inset-0 bg-black/50 backdrop-blur"
                onClick={() => {
                  if (saveCase.isPending) return;
                  setCaseModalOpen(false);
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={editingCase ? "Editar caso concreto" : "Novo caso concreto"}
                className="fixed left-1/2 top-1/2 w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/20 bg-background/95 shadow-xl backdrop-blur"
              >
                <div className="flex max-h-[90vh] flex-col">
                  <header className="border-b border-border/10 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold">{editingCase ? "Editar caso concreto" : "Adicionar caso concreto"}</h2>
                  </header>
                  <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-1">
                      <Label htmlFor="case_title">Título (opcional)</Label>
                      <Input
                        id="case_title"
                        value={caseTitle}
                        onChange={(event) => setCaseTitle(event.target.value)}
                        placeholder="Ex.: Caso 1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="case_content">Descrição *</Label>
                      <Textarea
                        id="case_content"
                        rows={7}
                        value={caseContent}
                        onChange={(event) => setCaseContent(event.target.value)}
                        placeholder="Descreva os fatos e detalhes do caso concreto."
                      />
                    </div>
                    {caseError ? <p className="text-sm text-destructive">{caseError}</p> : null}
                  </div>
                  <footer className="border-t border-border/10 p-4 sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        type="button"
                        disabled={saveCase.isPending}
                        onClick={() => setCaseModalOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="button" disabled={saveCase.isPending} onClick={submitCase}>
                        {saveCase.isPending ? "Salvando..." : editingCase ? "Atualizar caso" : "Criar caso"}
                      </Button>
                    </div>
                  </footer>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {caseDeleteOpen && caseToDelete && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <div
                aria-hidden="true"
                className="fixed inset-0 bg-black/50 backdrop-blur"
                onClick={() => {
                  if (deleteCase.isPending) return;
                  setCaseDeleteOpen(false);
                  setCaseToDelete(null);
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirmar exclusão de caso concreto"
                className="fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/20 bg-background/95 p-5 shadow-xl backdrop-blur"
              >
                <h2 className="text-lg font-semibold">Excluir caso concreto</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tem certeza que deseja excluir este caso? Esta ação não poderá ser desfeita.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={deleteCase.isPending}
                    onClick={() => {
                      setCaseDeleteOpen(false);
                      setCaseToDelete(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={deleteCase.isPending}
                    onClick={() => deleteCase.mutate(caseToDelete.id)}
                  >
                    {deleteCase.isPending ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {movementOpen && movementProcess && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <div
                aria-hidden="true"
                className="fixed inset-0 bg-black/50 backdrop-blur"
                onClick={() => {
                  if (createLastMovement.isPending) return;
                  closeMovementModal();
                }}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-label="Registrar última movimentação"
                className="fixed left-1/2 top-1/2 w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/20 bg-background/95 shadow-xl backdrop-blur"
              >
                <div className="flex max-h-[90vh] flex-col">
                  <header className="border-b border-border/10 bg-background/95 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Última Movimentação</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Processo: <span className="font-mono text-xs">{formatProcessCNJ(movementProcess.numero)}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label="Fechar modal"
                        disabled={createLastMovement.isPending}
                        onClick={closeMovementModal}
                      >
                        ✕
                      </Button>
                    </div>
                  </header>

                  <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-1">
                      <Label htmlFor="movement_file">Upload do documento *</Label>
                      <Input
                        id="movement_file"
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(event) => setMovementFile(event.target.files?.[0] ?? null)}
                      />
                      {movementFile ? (
                        <p className="text-xs text-muted-foreground">
                          {movementFile.name} • {formatFileSize(movementFile.size)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Formato recomendado: PDF (máx. 10MB).</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="movement_title">Título da tarefa *</Label>
                      <Input
                        id="movement_title"
                        value={movementTitle}
                        onChange={(event) => setMovementTitle(event.target.value)}
                        placeholder="Ex.: Cumprir despacho — juntar documentos"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="movement_due_date">Prazo (data) *</Label>
                        <Input
                          id="movement_due_date"
                          value={movementDate}
                          onChange={(event) => setMovementDate(event.target.value)}
                          placeholder="dd/mm/aaaa"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="movement_due_time">Prazo (hora) *</Label>
                        <Input
                          id="movement_due_time"
                          value={movementTime}
                          onChange={(event) => setMovementTime(event.target.value)}
                          placeholder="HH:mm"
                        />
                      </div>
                    </div>

                    {movementError ? <p className="text-sm text-destructive">{movementError}</p> : null}
                    {movementConflict ? (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
                        <p className="text-amber-700 dark:text-amber-300">{movementConflict}</p>
                        <Button asChild variant="outline" size="sm" className="mt-3">
                          <Link href={`/dashboard/${slug}/tarefas`}>Abrir Kanban</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <footer className="border-t border-border/10 bg-background/95 p-4 sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        type="button"
                        disabled={createLastMovement.isPending}
                        onClick={closeMovementModal}
                      >
                        Cancelar
                      </Button>
                      <Button type="button" disabled={createLastMovement.isPending} onClick={submitLastMovement}>
                        {createLastMovement.isPending ? "Criando..." : "Criar tarefa"}
                      </Button>
                    </div>
                  </footer>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
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

function getNowDateTimeFields() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
}

function parsePtBrDateTimeToIso(dateStr: string, timeStr: string): string | null {
  const dateMatch = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeStr.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
