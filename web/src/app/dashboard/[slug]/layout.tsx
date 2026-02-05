"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/v1/auth/me")).data as { nome: string; email: string; role: string },
    retry: false
  });

  const tenant = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => (await api.get("/v1/tenants/me")).data as { slug: string },
    retry: false,
    enabled: me.isSuccess
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const status = (me.error as any)?.response?.status;
    if (status === 401) {
      clearTokens();
      router.replace("/login");
    }
  }, [me.error, router]);

  useEffect(() => {
    if (tenant.data?.slug && tenant.data.slug !== slug) {
      router.replace(`/dashboard/${tenant.data.slug}`);
    }
  }, [slug, tenant.data?.slug, router]);

  const hasToken = !!getAccessToken();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold" href={`/dashboard/${slug}`}>
              SaaS Jurídico
            </Link>
            <span className="text-xs text-zinc-500">Tenant: {slug}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              clearTokens();
              router.replace("/login");
            }}
            type="button"
          >
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 md:grid-cols-4">
        <aside className="space-y-2 md:col-span-1">
          <NavLink href={`/dashboard/${slug}/clients`} label="Clientes" />
          <NavLink href={`/dashboard/${slug}/parcerias`} label="Parcerias" />
          <NavLink href={`/dashboard/${slug}/processes`} label="Processos" />
          <NavLink href={`/dashboard/${slug}/honorarios`} label="Honorários" />
          <NavLink href={`/dashboard/${slug}/agenda`} label="Agenda" />
          <NavLink href={`/dashboard/${slug}/tarefas`} label="Tarefas" />
          <NavLink href={`/dashboard/${slug}/documents`} label="Documentos" />
        </aside>
        <main className="md:col-span-3">
          {!hasToken ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-600">Redirecionando para login…</p>
              </CardContent>
            </Card>
          ) : me.isLoading || tenant.isLoading ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-zinc-600">Validando sessão…</p>
              </CardContent>
            </Card>
          ) : me.isError || tenant.isError ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-red-600">
                  {(me.error as any)?.response?.data?.detail ??
                    (tenant.error as any)?.response?.data?.detail ??
                    "Falha ao validar sessão"}
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    clearTokens();
                    router.replace("/login");
                  }}
                >
                  Voltar para login
                </Button>
              </CardContent>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild className="w-full justify-start" variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
