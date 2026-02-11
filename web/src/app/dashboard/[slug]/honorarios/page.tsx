"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { centsToDecimalString, formatDateBR, maskCurrencyBRL, parseCurrencyToCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Client = { id: string; nome: string; tipo_documento: "cpf" | "cnpj"; documento: string };
type Proc = { id: string; client_id: string; numero: string };
type Honorario = {
  id: string;
  client_id: string;
  process_id?: string | null;
  valor: string;
  data_vencimento: string;
  qtd_parcelas: number;
  percentual_exito?: number | null;
  percentual_parceiro?: number | null;
  status: "aberto" | "pago";
  pago_em?: string | null;
  valor_pago?: string | null;
  meio_pagamento?: string | null;
  comprovante_document_id?: string | null;
};

const schema = z.object({
  client_id: z.string().uuid(),
  process_id: z.string().uuid().or(z.literal("")).default(""),
  valor: z.string().min(1),
  data_vencimento: z.string().min(8),
  qtd_parcelas: z.coerce.number().int().min(1).max(120).default(1),
  percentual_exito: z.coerce.number().int().min(0).max(100).default(10),
  percentual_parceiro: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(["aberto", "pago"]).default("aberto")
});
type FormValues = z.infer<typeof schema>;

export default function HonorariosPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [meioPagamento, setMeioPagamento] = useState<string>("pix");
  const [valorPago, setValorPago] = useState<string>("");
  const [pagoEm, setPagoEm] = useState<string>("");

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/v1/clients")).data
  });

  const processes = useQuery({
    queryKey: ["processes"],
    queryFn: async () => (await api.get<Proc[]>("/v1/processes")).data
  });

  const list = useQuery({
    queryKey: ["honorarios"],
    queryFn: async () => (await api.get<Honorario[]>("/v1/honorarios")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: "",
      process_id: "",
      valor: "",
      data_vencimento: "",
      qtd_parcelas: 1,
      percentual_exito: 10,
      percentual_parceiro: 0,
      status: "aberto"
    }
  });

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      const valorCents = parseCurrencyToCents(values.valor);
      const payload = {
        ...values,
        process_id: values.process_id ? values.process_id : null,
        valor: centsToDecimalString(valorCents)
      };
      if (editingId) {
        return (await api.put(`/v1/honorarios/${editingId}`, payload)).data;
      }
      return (await api.post("/v1/honorarios", payload)).data;
    },
    onSuccess: async () => {
      setEditingId(null);
      form.reset({
        client_id: "",
        process_id: "",
        valor: "",
        data_vencimento: "",
        qtd_parcelas: 1,
        percentual_exito: 10,
        percentual_parceiro: 0,
        status: "aberto"
      });
      await qc.invalidateQueries({ queryKey: ["honorarios"] });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/honorarios/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["honorarios"] });
    }
  });

  const confirmPayment = useMutation({
    mutationFn: async () => {
      if (!payingId) throw new Error("Selecione um honorário");

      const fd = new FormData();
      if (valorPago) fd.append("valor_pago", centsToDecimalString(parseCurrencyToCents(valorPago)));
      fd.append("meio_pagamento", meioPagamento);
      if (pagoEm) fd.append("pago_em", new Date(pagoEm).toISOString());
      if (comprovante) fd.append("comprovante", comprovante);

      const r = await api.post<Honorario>(`/v1/honorarios/${payingId}/confirm-payment`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return r.data;
    },
    onSuccess: async () => {
      setPayingId(null);
      setComprovante(null);
      setMeioPagamento("pix");
      setValorPago("");
      setPagoEm("");
      await qc.invalidateQueries({ queryKey: ["honorarios"] });
    }
  });

  const downloadComprovante = useMutation({
    mutationFn: async (documentId: string) => {
      const r = await api.get(`/v1/documents/${documentId}/content`, {
        params: { disposition: "attachment" },
        responseType: "blob"
      });
      return r.data as Blob;
    },
    onSuccess: (blob, documentId) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprovante-${documentId}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  });

  const selectedClientId = form.watch("client_id");
  const processesForClient = (processes.data ?? []).filter((p) => p.client_id === selectedClientId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Honorários</CardTitle>
          <CardDescription>Conferência/baixa manual de pagamento + comprovante.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Editar honorário" : "Novo honorário"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="space-y-1 md:col-span-2">
              <Label>Cliente</Label>
              <Select
                {...form.register("client_id")}
                onChange={(e) => {
                  form.setValue("client_id", e.target.value);
                  // When switching client, clear process selection.
                  form.setValue("process_id", "");
                }}
              >
                <option value="">Selecione o cliente</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.tipo_documento.toUpperCase()}: {c.documento})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Processo (opcional)</Label>
              <Select {...form.register("process_id")} disabled={!selectedClientId}>
                <option value="">(sem processo)</option>
                {processesForClient.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero}
                  </option>
                ))}
              </Select>
              {!selectedClientId ? <p className="text-xs text-muted-foreground">Selecione um cliente para listar os processos.</p> : null}
            </div>

            <div className="space-y-1">
              <Label>Valor Inicial</Label>
              <Input
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={form.watch("valor")}
                onChange={(e) => form.setValue("valor", maskCurrencyBRL(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label>Data de Início do Pagamento</Label>
              <Input type="date" {...form.register("data_vencimento")} />
            </div>

            <div className="space-y-1">
              <Label>Parcelas</Label>
              <Input type="number" min={1} max={120} {...form.register("qtd_parcelas")} />
            </div>

            <div className="space-y-1">
              <Label>Percentual no êxito</Label>
              <Select {...form.register("percentual_exito")}>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>% do parceiro</Label>
              <Select {...form.register("percentual_parceiro")}>
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="30">30%</option>
                <option value="40">40%</option>
                <option value="50">50%</option>
                <option value="60">60%</option>
                <option value="70">70%</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select {...form.register("status")}>
                <option value="aberto">aberto</option>
                <option value="pago">pago</option>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button disabled={create.isPending} type="submit">
                {create.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({
                      client_id: "",
                      process_id: "",
                      valor: "",
                      data_vencimento: "",
                      qtd_parcelas: 1,
                      percentual_exito: 10,
                      percentual_parceiro: 0,
                      status: "aberto"
                    });
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>

          {create.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {(create.error as any)?.response?.data?.detail ?? "Erro ao salvar honorário"}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {payingId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dar baixa (pagar)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="space-y-1 md:col-span-2">
                <Label>Meio</Label>
                <Select value={meioPagamento} onChange={(e) => setMeioPagamento(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="transferencia">Transferência</option>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Valor pago</Label>
                <Input
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={valorPago}
                  onChange={(e) => setValorPago(maskCurrencyBRL(e.target.value))}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Pago em</Label>
                <Input
                  className="min-w-[260px]"
                  type="datetime-local"
                  value={pagoEm}
                  onChange={(e) => setPagoEm(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Comprovante</Label>
                <Input type="file" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button type="button" disabled={confirmPayment.isPending} onClick={() => confirmPayment.mutate()}>
                {confirmPayment.isPending ? "Salvando…" : "Confirmar pagamento"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setPayingId(null);
                  setComprovante(null);
                  setMeioPagamento("pix");
                  setValorPago("");
                  setPagoEm("");
                }}
              >
                Cancelar
              </Button>
            </div>

            {confirmPayment.isError ? (
              <p className="mt-3 text-sm text-destructive">
                {(confirmPayment.error as any)?.response?.data?.detail ?? (confirmPayment.error as Error).message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : null}
          {list.data ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Valor Inicial</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Êxito</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{clients.data?.find((c) => c.id === h.client_id)?.nome ?? h.client_id}</TableCell>
                      <TableCell>
                        {h.process_id
                          ? processes.data?.find((p) => p.id === h.process_id)?.numero ?? h.process_id
                          : "(sem processo)"}
                      </TableCell>
                      <TableCell>{h.valor}</TableCell>
                      <TableCell>{formatDateBR(h.data_vencimento)}</TableCell>
                      <TableCell>{h.qtd_parcelas ?? 1}</TableCell>
                      <TableCell>{h.percentual_exito != null ? `${h.percentual_exito}%` : "—"}</TableCell>
                      <TableCell>{h.percentual_parceiro != null ? `${h.percentual_parceiro}%` : "—"}</TableCell>
                      <TableCell>{h.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {h.status === "aberto" ? (
                            <Button variant="outline" size="sm" type="button" onClick={() => setPayingId(h.id)}>
                              Dar baixa
                            </Button>
                          ) : h.comprovante_document_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() => downloadComprovante.mutate(h.comprovante_document_id!)}
                            >
                              Comprovante
                            </Button>
                          ) : (
                            <span className="self-center text-xs text-muted-foreground">Pago</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setEditingId(h.id);
                              form.reset({
                                client_id: h.client_id,
                                process_id: h.process_id ?? "",
                                valor: maskCurrencyBRL(String(h.valor)),
                                data_vencimento: h.data_vencimento,
                                qtd_parcelas: h.qtd_parcelas ?? 1,
                                percentual_exito: (h.percentual_exito ?? 10) as any,
                                percentual_parceiro: (h.percentual_parceiro ?? 0) as any,
                                status: h.status as any
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(h.id)}
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
            <p className="mt-3 text-sm text-destructive">{(list.error as any)?.response?.data?.detail ?? "Erro ao listar honorários"}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
