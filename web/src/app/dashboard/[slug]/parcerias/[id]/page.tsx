"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatFullAddress } from "@/lib/address";
import { formatCNPJ, formatCPF, formatPhoneBR } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

type Parceria = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  oab_uf?: string | null;
  oab_number?: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
};

export default function ParceriaDetailPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params.slug;
  const parceriaId = params.id;

  const parceria = useQuery({
    queryKey: ["parceria", parceriaId],
    queryFn: async () => (await api.get<Parceria>(`/v1/parcerias/${parceriaId}`)).data
  });

  const data = parceria.data;
  const fullAddress = data
    ? formatFullAddress({
        street: data.address_street,
        number: data.address_number,
        complement: data.address_complement,
        neighborhood: data.address_neighborhood,
        city: data.address_city,
        state: data.address_state,
        zip: data.address_zip
      })
    : "-";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Parceria: {data?.nome ?? "—"}</CardTitle>
              <CardDescription>Dados completos da parceria.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href={`/dashboard/${slug}/parcerias`}>Voltar</Link>
            </Button>
          </div>
          {parceria.isError ? <p className="text-sm text-destructive">Erro ao carregar parceria.</p> : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          {parceria.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {data ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoItem label="Nome" value={data.nome} />
              <InfoItem
                label="Documento"
                value={`${data.tipo_documento.toUpperCase()} ${
                  data.tipo_documento === "cpf" ? formatCPF(data.documento) : formatCNPJ(data.documento)
                }`}
              />
              <InfoItem label="E-mail" value={data.email ?? null} />
              <InfoItem label="Telefone" value={data.telefone ? formatPhoneBR(data.telefone) : null} />
              <InfoItem label="OAB" value={data.oab_number ? [data.oab_uf, data.oab_number].filter(Boolean).join(" ") : null} />
              <InfoItem label="Endereço completo" value={fullAddress === "-" ? null : fullAddress} />
            </div>
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
