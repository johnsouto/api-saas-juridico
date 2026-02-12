"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskPieChart } from "@/components/dashboard/TaskPieChart";

type Proc = { id: string; status: "ativo" | "inativo" | "outros"; criado_em: string };
type BillingStatus = {
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  is_plus_effective: boolean;
  limits?: { max_users: number; max_storage_mb: number };
};
type DocumentsUsage = { used_bytes: number };
type KanbanSummary = { due_today: number; pendente: number; em_andamento: number; concluido: number };
type AgendaEvent = { id: string; titulo: string; inicio_em: string };

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
      const processes = await api.get<Proc[]>("/v1/processes").then((r) => r.data);
      return {
        processes: processes.length,
        processesData: processes
      };
    }
  });

  const kanban = useQuery({
    queryKey: ["kanban-summary"],
    queryFn: async () => (await api.get<KanbanSummary>("/v1/kanban/summary")).data,
    retry: false
  });

  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const monthBounds = useMemo(() => getMonthBounds(calendarMonth), [calendarMonth]);

  const agenda = useQuery({
    queryKey: ["dashboard-agenda", monthBounds.from, monthBounds.to],
    queryFn: async () =>
      (
        await api.get<AgendaEvent[]>("/v1/agenda", {
          params: { from: monthBounds.from, to: monthBounds.to }
        })
      ).data,
    retry: false
  });

  const eventsByDay = useMemo(() => {
    const entries = new Map<number, AgendaEvent[]>();
    for (const event of agenda.data ?? []) {
      const day = getDayInSaoPaulo(event.inicio_em);
      if (!day) continue;
      if (!entries.has(day)) entries.set(day, []);
      entries.get(day)!.push(event);
    }
    return entries;
  }, [agenda.data]);

  const daysInMonth = useMemo(
    () => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate(),
    [calendarMonth]
  );
  const safeSelectedDay = Math.max(1, Math.min(selectedDay, daysInMonth));
  const selectedDayEvents = eventsByDay.get(safeSelectedDay) ?? [];

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <Card className="flex min-h-[320px] flex-col md:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">Calendário</CardTitle>
            <CardDescription className="text-xs">Eventos da sua agenda.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setCalendarMonth((current) => shiftMonth(current, -1));
                  setSelectedDay(1);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-sm font-medium capitalize">{formatMonthLabel(calendarMonth)}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setCalendarMonth((current) => shiftMonth(current, 1));
                  setSelectedDay(1);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {buildMonthGrid(calendarMonth).map((day, index) =>
                day === null ? (
                  <span key={`blank-${index}`} className="h-9 rounded-md" />
                ) : (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={[
                      "relative flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                      day === safeSelectedDay ? "bg-primary text-primary-foreground" : "hover:bg-card/40",
                      eventsByDay.has(day) ? "font-semibold" : "text-muted-foreground"
                    ].join(" ")}
                  >
                    {day}
                    {eventsByDay.has(day) ? (
                      <span
                        className={[
                          "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                          day === safeSelectedDay ? "bg-primary-foreground" : "bg-emerald-400"
                        ].join(" ")}
                      />
                    ) : null}
                  </button>
                )
              )}
            </div>

            <div className="min-h-[92px] rounded-lg border border-border/15 bg-card/20 p-2">
              {agenda.isLoading ? <p className="text-xs text-muted-foreground">Carregando eventos…</p> : null}
              {!agenda.isLoading && (agenda.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento cadastrado.</p>
              ) : null}
              {selectedDayEvents.length > 0 ? (
                <div className="space-y-1">
                  {selectedDayEvents.map((event) => (
                    <div key={event.id} className="rounded-md border border-border/10 bg-card/40 px-2 py-1.5">
                      <p className="truncate text-xs font-medium">{event.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">{formatTimeInSaoPaulo(event.inicio_em)}</p>
                    </div>
                  ))}
                </div>
              ) : agenda.data && agenda.data.length > 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
              ) : null}
            </div>

            {agenda.isError ? <p className="text-xs text-destructive">Erro ao carregar agenda.</p> : null}

            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button asChild className="h-10 w-full" variant="outline">
                <Link href={`/dashboard/${slug}/agenda`}>Abrir agenda</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[300px] flex-col md:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">Tarefas</CardTitle>
            <CardDescription className="text-xs">Resumo do Kanban.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-start gap-4">
            <div className="flex items-center justify-center">
              <TaskPieChart
                dueToday={kanban.data?.due_today ?? 0}
                pendente={kanban.data?.pendente ?? 0}
                emAndamento={kanban.data?.em_andamento ?? 0}
                concluido={kanban.data?.concluido ?? 0}
              />
            </div>

            <div className="flex w-full max-w-[240px] flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Prazo expira hoje</span>
                <div className="min-w-[84px] rounded-lg bg-red-500 px-3 py-2 text-center text-sm font-semibold tabular-nums text-white shadow-sm ring-1 ring-border/25">
                  {kanban.data ? kanban.data.due_today : "—"}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Pendente</span>
                <div className="min-w-[84px] rounded-lg bg-orange-500 px-3 py-2 text-center text-sm font-semibold tabular-nums text-white shadow-sm ring-1 ring-border/25">
                  {kanban.data ? kanban.data.pendente : "—"}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Em andamento</span>
                <div className="min-w-[84px] rounded-lg bg-yellow-400 px-3 py-2 text-center text-sm font-semibold tabular-nums text-zinc-950 shadow-sm ring-1 ring-border/25">
                  {kanban.data ? kanban.data.em_andamento : "—"}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={[
                    "text-xs",
                    (kanban.data?.concluido ?? 0) > 0 ? "font-medium text-emerald-600" : "text-muted-foreground"
                  ].join(" ")}
                  title="Concluídas"
                >
                  Sem pendências
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">(concluídas)</span>
                </span>
                <div className="min-w-[84px] rounded-lg bg-green-500 px-3 py-2 text-center text-sm font-semibold tabular-nums text-white shadow-sm ring-1 ring-border/25">
                  {kanban.data ? kanban.data.concluido : "—"}
                </div>
              </div>
            </div>

            <div className="mt-auto flex w-full flex-wrap items-center gap-2">
              <Button asChild className="h-10 w-full" variant="outline">
                <Link href={`/dashboard/${slug}/tarefas`}>Abrir kanban</Link>
              </Button>
            </div>

            {kanban.isError ? <p className="text-xs text-destructive">Erro ao carregar resumo de tarefas.</p> : null}
          </CardContent>
        </Card>

        <Card className="flex flex-col md:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">Relatório</CardTitle>
            <CardDescription className="text-xs">Exporte seus dados em Excel.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center">
              <ExcelIcon />
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              <Button
                className="h-10 w-full"
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

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthBounds(date: Date): { from: string; to: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function buildMonthGrid(date: Date): Array<number | null> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];

  for (let i = 0; i < firstDayWeek; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMonthLabel(date: Date): string {
  const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return `${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

function getDayInSaoPaulo(input: string): number | null {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const value = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(date);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimeInSaoPaulo(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo"
  }).format(date);
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

function ExcelIcon() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-20 w-20 sm:h-24 sm:w-24 drop-shadow-sm"
      role="img"
      aria-label="Ícone do Excel"
    >
      <defs>
        <linearGradient id="excelGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(34, 197, 94, 0.55)" />
          <stop offset="100%" stopColor="rgba(16, 185, 129, 0.15)" />
        </linearGradient>
      </defs>

      <rect x="18" y="20" width="84" height="80" rx="14" fill="url(#excelGlow)" />
      <rect x="24" y="26" width="72" height="68" rx="10" fill="rgba(15, 23, 42, 0.2)" />
      <rect x="30" y="32" width="40" height="56" rx="8" fill="#16A34A" />
      <path
        d="M42 46 L50 60 L42 74 M58 46 L50 60 L58 74"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="74" y="32" width="16" height="12" rx="3" fill="#22C55E" />
      <rect x="74" y="50" width="16" height="12" rx="3" fill="#22C55E" />
      <rect x="74" y="68" width="16" height="12" rx="3" fill="#22C55E" />
    </svg>
  );
}
