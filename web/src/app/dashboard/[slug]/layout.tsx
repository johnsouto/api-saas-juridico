"use client";

import Link from "next/link";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Gavel,
  Handshake,
  LayoutDashboard,
  Moon,
  Sun,
  User,
  Users,
  Wallet
} from "lucide-react";

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
  const [collapsed, setCollapsed] = useState<boolean>(false);

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

  useEffect(() => {
    // Sidebar collapse preference (desktop only).
    try {
      setCollapsed(window.localStorage.getItem("ej_sidebar_collapsed") === "true");
    } catch {}
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
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href="/dashboard/perfil" aria-label="Perfil">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
            </Button>
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

      <div className="mx-auto max-w-6xl p-4">
        <div className="flex flex-col gap-6 md:flex-row">
          <aside
            className={cn(
              "space-y-2 md:shrink-0",
              // Mobile: full width (no collapse). Desktop: collapsible widths.
              collapsed ? "md:w-20" : "md:w-64",
              "w-full transition-[width] duration-200 ease-out"
            )}
          >
            <div className={cn("hidden md:flex items-center", collapsed ? "justify-center" : "justify-between")}>
              {!collapsed ? (
                <span className="px-2 text-xs font-medium text-muted-foreground">Menu</span>
              ) : null}
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                type="button"
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  try {
                    window.localStorage.setItem("ej_sidebar_collapsed", String(next));
                  } catch {}
                }}
              >
                {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </Button>
            </div>

            <NavLink
              theme={theme}
              collapsed={collapsed}
              icon={LayoutDashboard}
              href="/dashboard"
              label="Dashboard"
              activeOn={["/dashboard", `/dashboard/${slug}`]}
            />
            <NavLink theme={theme} collapsed={collapsed} icon={Users} href={`/dashboard/${slug}/clients`} label="Clientes" />
            <NavLink theme={theme} collapsed={collapsed} icon={Handshake} href={`/dashboard/${slug}/parcerias`} label="Parcerias" />
            <NavLink theme={theme} collapsed={collapsed} icon={Gavel} href={`/dashboard/${slug}/processes`} label="Processos" />
            <NavLink theme={theme} collapsed={collapsed} icon={Wallet} href={`/dashboard/${slug}/honorarios`} label="Honorários" />
            <NavLink theme={theme} collapsed={collapsed} icon={Calendar} href={`/dashboard/${slug}/agenda`} label="Agenda" />
            <NavLink theme={theme} collapsed={collapsed} icon={LayoutDashboard} href={`/dashboard/${slug}/tarefas`} label="Tarefas" />
            <NavLink theme={theme} collapsed={collapsed} icon={FileText} href={`/dashboard/${slug}/documents`} label="Documentos" />
          </aside>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  activeOn,
  theme,
  collapsed,
  icon: Icon
}: {
  href: string;
  label: string;
  activeOn?: string[];
  theme: AppTheme;
  collapsed: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const currentPath = usePathname();

  const isActive = (() => {
    if (activeOn?.length) return activeOn.includes(currentPath);
    if (currentPath === href) return true;
    return currentPath.startsWith(`${href}/`);
  })();

  const variant: "secondary" | "outline" = theme === "light" && isActive ? "secondary" : "outline";
  const className =
    theme === "dark"
      ? cn(
          "w-full border border-white/10 bg-transparent text-white/90",
          "hover:bg-white/5",
          "justify-start",
          collapsed ? "md:justify-center md:px-2" : null,
          isActive ? "bg-white/10 border-white/15 backdrop-blur-md shadow-sm text-white hover:bg-white/12" : null
        )
      : "w-full justify-start";

  const showTooltip = collapsed;

  return (
    <div className={cn("relative", showTooltip ? "md:group" : null)}>
      <Button
        asChild
        className={className}
        variant={variant}
        title={showTooltip ? label : undefined}
      >
        <Link href={href} aria-label={label} className={cn("flex items-center gap-2", collapsed ? "md:justify-center" : null)}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className={cn("truncate", collapsed ? "md:hidden" : null)}>{label}</span>
          {showTooltip ? <span className="sr-only">{label}</span> : null}
        </Link>
      </Button>

      {/* Tooltip (desktop + collapsed) */}
      {showTooltip ? (
        <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 md:block md:opacity-0 md:group-hover:opacity-100 md:transition md:duration-200">
          <div className="rounded-lg border border-border/20 bg-card/80 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur">
            {label}
          </div>
        </div>
      ) : null}
    </div>
  );
}
