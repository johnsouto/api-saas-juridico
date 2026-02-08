"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
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
    <div className="theme-premium min-h-screen bg-background text-foreground">
      {/* Decorative background (matches landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(35,64,102,0.30),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_90%,rgba(35,64,102,0.20),transparent_50%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold text-foreground" href={`/dashboard/${slug}`}>
              Elemento Juris
            </Link>
            <span className="text-xs text-muted-foreground">Tenant: {slug}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Placeholder until billing/subscription endpoint is wired. */}
            <Badge variant="secondary" className="border border-border/15 bg-card/40">
              Plano: Free
            </Badge>
            <Button asChild size="sm" className="shadow-glow">
              <Link href="/billing?plan=plus&next=/dashboard">Ativar Plus (R$47)</Link>
            </Button>
            <Button
              size="sm"
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
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-4">
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
