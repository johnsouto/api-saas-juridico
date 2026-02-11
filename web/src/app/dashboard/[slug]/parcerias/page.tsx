"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Parceria = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
};

function onlyDigits(input: string): string {
  return input.replace(/\D/g, "");
}

const schema = z.object({
  nome: z.string().min(2, "Informe o nome do parceiro."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  telefone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || onlyDigits(v).length >= 10, { message: "Informe um telefone válido." }),
  oab_number: z.string().optional().or(z.literal("")),
  tipo_documento: z.enum(["cpf", "cnpj"]).default("cpf"),
  documento: z
    .string()
    .min(8, "Informe o documento.")
    .refine((v) => onlyDigits(v).length >= 8, { message: "Informe um documento válido." })
    .refine((v) => onlyDigits(v) === v, { message: "Use somente números." })
});
type FormValues = z.infer<typeof schema>;

export default function ParceriasPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["parcerias"],
    queryFn: async () => (await api.get<Parceria[]>("/v1/parcerias")).data
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" }
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        email: values.email ? values.email : null,
        telefone: values.telefone ? onlyDigits(values.telefone) : null,
        oab_number: values.oab_number ? values.oab_number : null
      };
      if (editingId) return (await api.put(`/v1/parcerias/${editingId}`, payload)).data;
      return (await api.post("/v1/parcerias", payload)).data;
    },
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      form.reset({ nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" });
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
      toast(wasEditing ? "Parceria atualizada com sucesso." : "Parceria cadastrada com sucesso.", {
        variant: "success"
      });
    },
    onError: () => {
      toast("Não foi possível salvar a parceria. Tente novamente.", { variant: "error" });
    }
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/v1/parcerias/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parcerias"] });
      toast("Parceria excluída.", { variant: "success" });
    },
    onError: () => {
      toast("Não foi possível excluir a parceria. Tente novamente.", { variant: "error" });
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Parcerias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cadastre parceiros e vincule processos a eles (opcional).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{editingId ? "Editar parceiro" : "Novo parceiro"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-3 md:grid-cols-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="parceria_nome">Nome *</Label>
              <Input id="parceria_nome" placeholder="Nome do parceiro" {...form.register("nome")} />
              {form.formState.errors.nome ? <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="parceria_email">E-mail (opcional)</Label>
              <Input id="parceria_email" type="email" placeholder="email@exemplo.com" {...form.register("email")} />
              {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message}</p> : null}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parceria_telefone">Telefone (opcional)</Label>
              <Input id="parceria_telefone" inputMode="tel" placeholder="(11) 99999-9999" {...form.register("telefone")} />
              {form.formState.errors.telefone ? (
                <p className="text-xs text-destructive">{form.formState.errors.telefone.message}</p>
              ) : null}
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="parceria_oab">Número da OAB (opcional)</Label>
              <Input id="parceria_oab" placeholder="Ex: SP 123456" {...form.register("oab_number")} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="parceria_tipo">Tipo *</Label>
              <Select id="parceria_tipo" {...form.register("tipo_documento")}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parceria_documento">Documento *</Label>
              <Input
                id="parceria_documento"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Somente números"
                {...form.register("documento", {
                  onChange: (e) => {
                    form.setValue("documento", onlyDigits(e.target.value), { shouldValidate: true });
                  }
                })}
              />
              {form.formState.errors.documento ? (
                <p className="text-xs text-destructive">{form.formState.errors.documento.message}</p>
              ) : null}
            </div>
            <div className="flex items-end gap-2 md:col-span-6">
              <Button disabled={save.isPending} type="submit">
                {save.isPending ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
              </Button>
              {editingId ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ nome: "", email: "", telefone: "", oab_number: "", tipo_documento: "cpf", documento: "" });
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          {save.isError ? <p className="mt-2 text-sm text-destructive">Não foi possível salvar a parceria.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {list.data && list.data.length === 0 ? (
            <div className="mt-3 rounded-xl border border-border/20 bg-card/40 p-6 text-sm text-muted-foreground">
              <p>Nenhuma parceria cadastrada ainda.</p>
              <Button
                className="mt-3"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Cadastrar primeira parceria
              </Button>
            </div>
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell>{p.email ?? "—"}</TableCell>
                      <TableCell>{p.telefone ?? "—"}</TableCell>
                      <TableCell>{p.oab_number ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.tipo_documento}:{p.documento}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingId(p.id);
                              form.reset({
                                nome: p.nome,
                                email: p.email ?? "",
                                telefone: p.telefone ?? "",
                                oab_number: p.oab_number ?? "",
                                tipo_documento: p.tipo_documento,
                                documento: p.documento
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
          {list.isError ? <p className="mt-2 text-sm text-destructive">Erro ao listar parcerias.</p> : null}
          {remove.isError ? <p className="mt-2 text-sm text-destructive">Erro ao excluir parceria.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
