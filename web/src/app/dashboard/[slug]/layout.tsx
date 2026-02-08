"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";

export default function TenantDashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { tenant, logout } = useAuth();

  const slug = params.slug;

  useEffect(() => {
    // Safety: if user tries to access a different tenant slug, redirect to the one from the session.
    if (tenant?.slug && tenant.slug !== slug) {
      router.replace(`/dashboard/${tenant.slug}`);
    }
  }, [router, slug, tenant?.slug]);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold" href={`/dashboard/${slug}`}>
              Elemento Juris
            </Link>
            <span className="text-xs text-zinc-500">Tenant: {slug}</span>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              router.replace("/login?next=/dashboard");
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
        <main className="md:col-span-3">{children}</main>
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

