"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Proc = { id: string; status: "ativo" | "inativo" | "outros"; criado_em: string };
type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  is_plus_effective: boolean;
  limits?: { max_users: number; max_storage_mb: number };
};
type DocumentsUsage = { used_bytes: number };

export default function DashboardHome() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await api.get("/v1/auth/me");
      return r.data as { nome: string; email: string; role: string };
    }
  });

  const billing = useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    retry: false
  });

  const isFreePlan = billing.isSuccess && billing.data.plan_code === "FREE" && !billing.data.is_plus_effective;

  const storageUsage = useQuery({
    queryKey: ["documents-usage"],
    queryFn: async () => (await api.get<DocumentsUsage>("/v1/documents/usage")).data,
    enabled: isFreePlan,
    retry: false
  });

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [clients, processes, honorarios] = await Promise.all([
        api.get<any[]>("/v1/clients").then((r) => r.data),
        api.get<Proc[]>("/v1/processes").then((r) => r.data),
        api.get<any[]>("/v1/honorarios").then((r) => r.data)
      ]);
      const honorariosAbertos = honorarios.filter((h: any) => String(h.status).toLowerCase() === "aberto").length;
      return {
        clients: clients.length,
        processes: processes.length,
        processesData: processes,
        honorarios: honorarios.length,
        honorariosAbertos
      };
    }
  });

  const exportXlsx = useMutation({
    mutationFn: async () => {
      const r = await api.get("/v1/reports/overview.xlsx", { responseType: "blob" });
      return r.data as Blob;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  });

  const processDistribution = (() => {
    const procs = stats.data?.processesData ?? [];
    const counts = { ativo: 0, inativo: 0, outros: 0 };
    for (const p of procs) {
      if (p.status === "ativo") counts.ativo += 1;
      else if (p.status === "inativo") counts.inativo += 1;
      else counts.outros += 1;
    }
    const total = procs.length || 1;
    return {
      counts,
      pct: {
        ativo: Math.round((counts.ativo / total) * 100),
        inativo: Math.round((counts.inativo / total) * 100),
        outros: Math.max(0, 100 - (Math.round((counts.ativo / total) * 100) + Math.round((counts.inativo / total) * 100)))
      }
    };
  })();

  const processesByMonth = (() => {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, () => 0);
    const procs = stats.data?.processesData ?? [];
    for (const p of procs) {
      const d = new Date(p.criado_em);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year) continue;
      months[d.getMonth()] += 1;
    }
    return { year, months };
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          {me.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {me.data ? (
            <div className="text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <div>
                  Login: <span className="font-medium">{me.data.email}</span>
                </div>
                <Badge variant="secondary">Usuário</Badge>
              </div>
            </div>
          ) : null}
          {me.isError ? (
            <p className="mt-2 text-sm text-destructive">Erro ao carregar usuário.</p>
          ) : null}
        </CardContent>
      </Card>

      {isFreePlan ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Armazenamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {storageUsage.isLoading ? <p className="text-sm text-muted-foreground">Carregando uso…</p> : null}
            {storageUsage.isError ? (
              <p className="text-sm text-destructive">Erro ao carregar uso de armazenamento.</p>
            ) : null}

            {storageUsage.data ? (
              <>
                {(() => {
                  const usedBytes = storageUsage.data?.used_bytes ?? 0;
                  const maxBytes = 100 * 1024 * 1024;
                  const pct = Math.min(100, Math.max(0, Math.round((usedBytes / maxBytes) * 100)));
                  const usedMb = usedBytes / 1024 / 1024;
                  const barClass = pct < 50 ? "bg-emerald-500" : pct < 80 ? "bg-amber-400" : "bg-red-500";

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="text-muted-foreground">Armazenamento (Free): {usedMb.toFixed(1)} MB de 100 MB</div>
                        <div className="tabular-nums text-muted-foreground">{pct}%</div>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-card/40">
                        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Faça upgrade para aumentar limites e enviar mais documentos.
                  </p>
                  <Button asChild size="sm" className="shadow-glow">
                    <Link href="/billing?plan=plus&next=/dashboard">Assinar Plus</Link>
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.data?.clients ?? "—"}</div>
            <Link
              className="mt-2 inline-block text-sm text-foreground underline decoration-border/20 underline-offset-4 hover:decoration-border/40"
              href={`/dashboard/${slug}/clients`}
            >
              Abrir clientes
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Processos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.data?.processes ?? "—"}</div>
            <Link
              className="mt-2 inline-block text-sm text-foreground underline decoration-border/20 underline-offset-4 hover:decoration-border/40"
              href={`/dashboard/${slug}/processes`}
            >
              Abrir processos
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Honorários (abertos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.data?.honorariosAbertos ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Total: {stats.data?.honorarios ?? "—"}</div>
            <Link
              className="mt-2 inline-block text-sm text-foreground underline decoration-border/20 underline-offset-4 hover:decoration-border/40"
              href={`/dashboard/${slug}/honorarios`}
            >
              Abrir honorários
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">Relatório</CardTitle>
            <CardDescription className="text-xs">Exporte seus dados em Excel.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center">
              <PieChart />
            </div>

            <div className="mt-4">
              <Button
                className="w-full"
                size="sm"
                variant="outline"
                type="button"
                disabled={exportXlsx.isPending}
                onClick={() => exportXlsx.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                {exportXlsx.isPending ? "Gerando..." : "Baixar relatório"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição de Status (Processos)</CardTitle>
          </CardHeader>
          <CardContent>
            <StackedProgressBar
              segments={[
                { label: `Ativos (${processDistribution.counts.ativo})`, pct: processDistribution.pct.ativo, className: "bg-emerald-500" },
                { label: `Inativos (${processDistribution.counts.inativo})`, pct: processDistribution.pct.inativo, className: "bg-red-500" },
                { label: `Outros (${processDistribution.counts.outros})`, pct: processDistribution.pct.outros, className: "bg-zinc-400" }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Processos por Mês ({processesByMonth.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              months={processesByMonth.months}
              stroke="#FACC15"
              fillFrom="#F59E0B"
              fillTo="#FACC15"
            />
          </CardContent>
        </Card>
      </div>

      {stats.isError ? (
        <p className="text-sm text-destructive">Erro ao carregar indicadores.</p>
      ) : null}
      {exportXlsx.isError ? (
        <p className="text-sm text-destructive">Erro ao exportar .xlsx.</p>
      ) : null}
    </div>
  );
}

function StackedProgressBar({
  segments
}: {
  segments: { label: string; pct: number; className: string }[];
}) {
  const totalPct = segments.reduce((acc, s) => acc + s.pct, 0);
  const normalized = totalPct === 100 ? segments : segments.map((s) => ({ ...s, pct: Math.max(0, Math.min(100, s.pct)) }));

  return (
    <div className="space-y-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-card/40">
        <div className="flex h-full w-full">
          {normalized.map((s) => (
            <div key={s.label} className={s.className} style={{ width: `${s.pct}%` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        {normalized.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span>{s.label}</span>
            <span className="tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaChart({
  months,
  stroke,
  fillFrom,
  fillTo
}: {
  months: number[];
  stroke: string;
  fillFrom: string;
  fillTo: string;
}) {
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const w = 640;
  const h = 220;
  const padX = 30;
  const padY = 20;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const max = Math.max(1, ...months);
  const points = months.map((v, i) => {
    const x = padX + (innerW * i) / (months.length - 1);
    const y = padY + innerH - (innerH * v) / max;
    return { x, y, v, i };
  });

  const lineD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${(padX + innerW).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${padX.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[520px]">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillTo} stopOpacity="0.45" />
            <stop offset="100%" stopColor={fillFrom} stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* axis */}
        <line
          x1={padX}
          y1={padY + innerH}
          x2={padX + innerW}
          y2={padY + innerH}
          stroke="rgb(var(--border) / 0.16)"
        />
        <line x1={padX} y1={padY} x2={padX} y2={padY + innerH} stroke="rgb(var(--border) / 0.16)" />

        {/* area + line */}
        <path d={areaD} fill="url(#areaFill)" />
        <path d={lineD} fill="none" stroke={stroke} strokeWidth="2.5" />

        {/* points */}
        {points.map((p) => (
          <circle
            key={p.i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill={stroke}
            stroke="rgb(var(--foreground))"
            strokeWidth="1.5"
          />
        ))}

        {/* x labels */}
        {points.map((p) => (
          <text
            key={`l-${p.i}`}
            x={p.x}
            y={padY + innerH + 16}
            textAnchor="middle"
            fontSize="11"
            fill="rgb(var(--muted-foreground) / 0.85)"
          >
            {labels[p.i]}
          </text>
        ))}

        {/* y max */}
        <text x={padX - 6} y={padY + 10} textAnchor="end" fontSize="11" fill="rgb(var(--muted-foreground) / 0.85)">
          {max}
        </text>
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">Eixo X: meses do ano corrente. Eixo Y: quantidade de processos.</p>
    </div>
  );
}

function PieChart() {
  // Decorative pie chart (donut) – purely visual.
  // Values are illustrative; they don't represent real analytics yet.
  const r = 40;
  const c = 2 * Math.PI * r;
  const segA = c * 0.55;
  const segB = c * 0.25;
  const segC = c - segA - segB;

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-28 w-28 drop-shadow-sm"
      role="img"
      aria-label="Gráfico de pizza"
    >
      <defs>
        <radialGradient id="ejDonutGlow" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(35, 64, 102, 0.35)" />
          <stop offset="100%" stopColor="rgba(35, 64, 102, 0)" />
        </radialGradient>
      </defs>

      {/* soft glow */}
      <circle cx="60" cy="60" r="52" fill="url(#ejDonutGlow)" />

      {/* base ring */}
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--border) / 0.10)" strokeWidth="18" />

      {/* segments */}
      <g transform="rotate(-90 60 60)">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#234066"
          strokeWidth="18"
          strokeDasharray={`${segA} ${c}`}
          strokeDashoffset={0}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#22C55E"
          strokeWidth="18"
          strokeDasharray={`${segB} ${c}`}
          strokeDashoffset={-segA}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#FACC15"
          strokeWidth="18"
          strokeDasharray={`${segC} ${c}`}
          strokeDashoffset={-(segA + segB)}
        />
      </g>

      {/* inner hole */}
      <circle cx="60" cy="60" r="24" fill="rgb(var(--background) / 0.25)" />
      <circle cx="60" cy="60" r="23" fill="rgb(var(--card) / 0.55)" />
    </svg>
  );
}
