"use client";

import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { BugReportButton } from "@/components/feedback/BugReportButton";
import { api } from "@/lib/api";
import { setIdleTimeoutMs } from "@/lib/session";
import { getEffectiveTheme, setTheme, type AppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  status: "free" | "active" | "past_due" | "canceled" | "expired" | "trialing";
  current_period_end: string | null;
  grace_period_end: string | null;
  is_plus_effective: boolean;
  message: string | null;
};

function planBadgeLabel(plan: BillingStatus["plan_code"]): string {
  if (plan === "PLUS_MONTHLY_CARD") return "Plano: Plus (Mensal)";
  if (plan === "PLUS_ANNUAL_PIX") return "Plano: Plus (Anual Pix)";
  return "Plano: Free";
}

export default function TenantDashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { tenant, user, logout } = useAuth();
  const [theme, setThemeState] = useState<AppTheme>("dark");

  const slug = params.slug;

  const billing = useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    retry: false
  });

  useEffect(() => {
    // Safety: if user tries to access a different tenant slug, redirect to the one from the session.
    if (tenant?.slug && tenant.slug !== slug) {
      router.replace(`/dashboard/${tenant.slug}`);
    }
  }, [router, slug, tenant?.slug]);

  useEffect(() => {
    setThemeState(getEffectiveTheme());
  }, []);

  const planCode = billing.data?.plan_code ?? "FREE";
  const status = billing.data?.status;
  const message = billing.data?.message;

  useEffect(() => {
    // Persist idle timeout policy based on tenant plan.
    // FREE: 12h | PLUS: 30 days
    const ms = planCode === "FREE" ? 12 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    setIdleTimeoutMs(ms);
  }, [planCode]);

  const officeName = tenant?.nome?.trim() ? tenant.nome : "Seu escritório";
  const firstName =
    (user?.first_name ?? "").trim() ||
    (user?.nome ?? "").trim().split(/\s+/).filter(Boolean)[0] ||
    "";
  const welcomeLine = firstName ? `Bem-vindo: Dr. ${firstName}` : "Bem-vindo";

  const cta = (() => {
    if (status === "past_due") {
      return { label: "Regularizar pagamento", href: "/billing?plan=plus_monthly_card&next=/dashboard" };
    }
    if (planCode === "FREE") {
      return { label: "Ativar Plus (R$47)", href: "/billing?plan=plus&next=/dashboard" };
    }
    if (planCode === "PLUS_ANNUAL_PIX") {
      return { label: "Renovar Plus anual (Pix)", href: "/billing?plan=plus_annual_pix&next=/dashboard" };
    }
    return { label: "Ver billing", href: "/billing?plan=plus&next=/dashboard" };
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Decorative background (matches landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(35,64,102,0.30),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_90%,rgba(35,64,102,0.20),transparent_50%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-foreground">Elemento Juris</div>
            <div className="text-xs text-muted-foreground">
              <div>Escritório: {officeName}</div>
              <div>{welcomeLine}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="border border-border/15 bg-card/40">
              {planBadgeLabel(planCode)}
            </Badge>
            <Button
              size="icon"
              variant="outline"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                setThemeState(next);
              }}
              type="button"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <BugReportButton />
            <Button asChild size="sm" className="shadow-glow">
              <Link href={cta.href}>{cta.label}</Link>
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

      {message ? (
        <div className="mx-auto w-full max-w-6xl px-4">
          <div
            className={cn(
              "mt-4 rounded-xl border border-border/15 bg-card/40 p-4 text-sm text-foreground/85 backdrop-blur",
              status === "past_due" ? "border-amber-400/30 bg-amber-500/10" : null
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>{message}</p>
              <Button asChild size="sm" className="shadow-glow">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-4">
        <aside className="space-y-2 md:col-span-1">
          <NavLink href="/dashboard" label="Dashboard" activeOn={["/dashboard", `/dashboard/${slug}`]} />
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

function NavLink({
  href,
  label,
  activeOn
}: {
  href: string;
  label: string;
  activeOn?: string[];
}) {
  const currentPath = usePathname();

  const isActive = (() => {
    if (activeOn?.length) return activeOn.includes(currentPath);
    if (currentPath === href) return true;
    return currentPath.startsWith(`${href}/`);
  })();

  return (
    <Button asChild className="w-full justify-start" variant={isActive ? "secondary" : "outline"}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
