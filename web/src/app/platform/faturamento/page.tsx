"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { PlatformNav } from "@/components/platform/PlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatDateTimeBR } from "@/lib/datetime";
import { api } from "@/lib/api";
import { clearPlatformAdminSession, getPlatformSessionState, lockPlatformAdminSession } from "@/lib/platformAuth";

type PlatformRevenueMonthlyPoint = {
  month: string;
  value: number;
};

type PlatformRevenueOverviewOut = {
  currency: "BRL";
  plan_price_monthly: number;
  active_plus_tenants: number;
  mrr: number;
  arr_estimated: number;
  revenue_ytd: number;
  monthly_series: PlatformRevenueMonthlyPoint[];
};

type PlatformRevenueTenantItem = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  plan: "plus";
  status: string;
  started_at: string | null;
  next_billing_at: string | null;
  last_payment_at: string | null;
  price_monthly: number;
};

const MONTH_LABELS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const GOAL_STORAGE_KEY = "platform_revenue_goal_monthly";

function formatMoneyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);
}

function monthToLabel(monthRef: string): string {
  const [yearRaw, monthRaw] = monthRef.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return monthRef;
  return `${MONTH_LABELS[month - 1]}/${year}`;
}

function RevenueSeriesChart({ series }: { series: PlatformRevenueMonthlyPoint[] }) {
  const maxValue = useMemo(() => Math.max(...series.map((item) => item.value), 0), [series]);
  if (!series.length) return <p className="text-sm text-muted-foreground">Nenhum dado mensal disponível.</p>;

  return (
    <div className="space-y-3">
      <div className="flex h-56 items-end gap-2">
        {series.map((item, index) => {
          const ratio = maxValue > 0 ? item.value / maxValue : 0;
          const height = Math.max(8, Math.round(ratio * 100));
          const label = monthToLabel(item.month);
          const showAxisLabel = index % 2 === 0 || index === series.length - 1;
          return (
            <div key={item.month} className="group flex flex-1 flex-col items-center">
              <div
                className="w-full rounded-t-md bg-[#234066]/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#234066] hover:shadow-md"
                style={{ height: `${height}%` }}
                title={`${label} — ${formatMoneyBRL(item.value)}`}
              />
              <span className="mt-2 text-[10px] font-medium text-muted-foreground">{showAxisLabel ? label : " "}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Passe o mouse nas barras para ver o valor mensal em R$.</p>
    </div>
  );
}

export default function PlatformRevenuePage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const [platformReady, setPlatformReady] = useState(false);
  const [platformAuthenticated, setPlatformAuthenticated] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [goalInput, setGoalInput] = useState("10000");

  const overview = useQuery({
    queryKey: ["platform-revenue-overview", selectedYear],
    queryFn: async () =>
      (
        await api.get<PlatformRevenueOverviewOut>("/v1/platform/metrics/revenue/overview", {
          params: { year: selectedYear }
        })
      ).data,
    retry: false,
    enabled: platformReady && platformAuthenticated
  });

  const tenants = useQuery({
    queryKey: ["platform-revenue-tenants"],
    queryFn: async () =>
      (
        await api.get<PlatformRevenueTenantItem[]>("/v1/platform/metrics/revenue/tenants", {
          params: { status: "ACTIVE", plan: "plus" }
        })
      ).data,
    retry: false,
    enabled: platformReady && platformAuthenticated
  });

  useEffect(() => {
    const state = getPlatformSessionState();
    setPlatformAuthenticated(state.valid);
    setPlatformReady(true);
    if (!state.valid) {
      router.replace(`/platform/login?reason=${state.reason ?? "missing"}&next=/platform/faturamento`);
      return;
    }

    const onPlatformAuthFailed = () => {
      setPlatformAuthenticated(false);
      router.replace("/platform/login?reason=unauthorized&next=/platform/faturamento");
    };
    window.addEventListener("platformAuthFailed", onPlatformAuthFailed);
    return () => window.removeEventListener("platformAuthFailed", onPlatformAuthFailed);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistedGoal = window.localStorage.getItem(GOAL_STORAGE_KEY);
    if (!persistedGoal) return;
    const parsed = Number.parseFloat(persistedGoal);
    if (Number.isFinite(parsed) && parsed > 0) {
      setGoalInput(String(parsed));
    }
  }, []);

  const goalValue = useMemo(() => {
    const parsed = Number.parseFloat(goalInput.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [goalInput]);

  const mrr = overview.data?.mrr ?? 0;
  const progressPercent = goalValue > 0 ? Math.min((mrr / goalValue) * 100, 100) : 0;

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      {!platformReady ? <p className="text-sm text-muted-foreground">Verificando sessão da plataforma...</p> : null}

      <Card className="border-border/20 bg-card/70 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Admin da Plataforma (Super-admin)</CardTitle>
            <CardDescription>Visão financeira dos tenants Plus ativos.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                lockPlatformAdminSession();
                router.replace("/platform/login?reason=locked&next=/platform/faturamento");
              }}
            >
              Travar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                clearPlatformAdminSession();
                router.replace("/platform/login");
              }}
            >
              Sair
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <PlatformNav />
        </CardContent>
      </Card>

      <Card className="border-border/20 bg-[linear-gradient(135deg,rgba(35,64,102,0.22),rgba(14,30,43,0.12))]">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl">Faturamento</CardTitle>
            <CardDescription>Visão do crescimento do Elemento Juris.</CardDescription>
          </div>
          <div className="w-full max-w-[180px] space-y-1">
            <Label htmlFor="platform_revenue_year">Ano</Label>
            <Select
              id="platform_revenue_year"
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number.parseInt(event.target.value, 10) || currentYear)}
            >
              {yearOptions.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
      </Card>

      {overview.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {(overview.error as any)?.response?.data?.detail ?? "Não foi possível carregar o painel de faturamento."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {overview.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">MRR Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatMoneyBRL(overview.data.mrr)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Tenants Plus ativos: {overview.data.active_plus_tenants}</p>
              </CardContent>
            </Card>

            <Card className="transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">ARR Estimado</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatMoneyBRL(overview.data.arr_estimated)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Estimativa baseada no MRR atual.</p>
              </CardContent>
            </Card>

            <Card className="transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Receita no Ano (YTD)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatMoneyBRL(overview.data.revenue_ytd)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ano selecionado: {selectedYear}</p>
              </CardContent>
            </Card>

            <Card className="border-border/20 bg-card/70 backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Meta do mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    value={goalInput}
                    onChange={(event) => setGoalInput(event.target.value)}
                    placeholder="Ex: 10000"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (goalValue <= 0) {
                        toast("Informe uma meta mensal válida.", { variant: "error" });
                        return;
                      }
                      window.localStorage.setItem(GOAL_STORAGE_KEY, String(goalValue));
                      toast("Meta mensal salva.", { variant: "success" });
                    }}
                  >
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Meta atual: {goalValue > 0 ? formatMoneyBRL(goalValue) : "não definida"}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#0e1e2b]/20">
                  <div
                    className="h-full rounded-full bg-[#234066] transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
                  />
                </div>
                <p className="text-xs font-medium">{`Você está em ${Math.round(progressPercent)}% da meta.`}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/20">
            <CardHeader>
              <CardTitle className="text-base">Série mensal (últimos 12 meses)</CardTitle>
              <CardDescription>
                Valor por mês com base em assinaturas Plus mensais ativas ({formatMoneyBRL(overview.data.plan_price_monthly)}/mês).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueSeriesChart series={overview.data.monthly_series} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants Plus que compõem o faturamento</CardTitle>
          <CardDescription>Assinaturas mensais ativas consideradas no MRR.</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.isLoading ? <p className="text-sm text-muted-foreground">Carregando tenants...</p> : null}
          {tenants.isError ? (
            <p className="text-sm text-destructive">
              {(tenants.error as any)?.response?.data?.detail ?? "Não foi possível carregar os tenants de faturamento."}
            </p>
          ) : null}
          {tenants.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escritório</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Próxima cobrança</TableHead>
                    <TableHead>Valor mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.data.map((tenant) => (
                    <TableRow key={tenant.tenant_id}>
                      <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                      <TableCell className="font-mono text-xs">{tenant.tenant_slug}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === "ACTIVE" ? "success" : "warning"}>{tenant.status}</Badge>
                      </TableCell>
                      <TableCell>{tenant.started_at ? formatDateTimeBR(tenant.started_at) : "—"}</TableCell>
                      <TableCell>{tenant.next_billing_at ? formatDateTimeBR(tenant.next_billing_at) : "—"}</TableCell>
                      <TableCell className="font-medium">{formatMoneyBRL(tenant.price_monthly)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {tenants.data && tenants.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tenant Plus mensal ativo encontrado.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
