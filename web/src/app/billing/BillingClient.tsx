"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Container } from "@/components/landing/Container";
import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/datetime";
import { trackEvent } from "@/lib/gtm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type BillingStatus = {
  tenant_id: string;
  plan_code: "FREE" | "PLUS_MONTHLY_CARD" | "PLUS_ANNUAL_PIX";
  status: "free" | "active" | "past_due" | "canceled" | "expired" | "trialing";
  current_period_end: string | null;
  grace_period_end: string | null;
  is_plus_effective: boolean;
  message: string | null;
  limits: { max_users: number; max_clients?: number | null; max_storage_mb: number };
};

type BillingCheckout = {
  checkout_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  expires_at: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

function safeNext(nextValue: string | null): string {
  if (!nextValue) return "/dashboard";
  const v = nextValue.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/dashboard";
  return v;
}

function planLabel(plan: BillingStatus["plan_code"]): string {
  if (plan === "PLUS_MONTHLY_CARD") return "Plus (Mensal)";
  if (plan === "PLUS_ANNUAL_PIX") return "Plus (Anual Pix)";
  return "Free";
}

export function BillingClient() {
  const router = useRouter();
  const search = useSearchParams();

  const nextPath = useMemo(() => safeNext(search.get("next")), [search]);
  const planParam = useMemo(() => (search.get("plan") ?? "plus").toLowerCase(), [search]);

  const [pixInfo, setPixInfo] = useState<BillingCheckout | null>(null);

  useEffect(() => {
    trackEvent("ej_billing_view", { plan_param: planParam });
  }, [planParam]);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await api.get("/v1/auth/me");
      return r.data as { nome: string; email: string; role: string };
    },
    retry: false
  });

  const status = useQuery({
    queryKey: ["billing-status"],
    queryFn: async () => (await api.get<BillingStatus>("/v1/billing/status")).data,
    enabled: me.isSuccess,
    retry: false
  });

  const startCheckout = useMutation({
    mutationFn: async (plan: "plus_monthly_card" | "plus_annual_pix") => {
      const r = await api.post<BillingCheckout>("/v1/billing/checkout", null, {
        params: { plan, next: nextPath }
      });
      return r.data;
    },
    onMutate: (plan) => {
      trackEvent("ej_billing_checkout_start", { plan });
    },
    onSuccess: (data) => {
      const url = data.checkout_url;
      if (url) {
        const provider = url.includes("mercadopago.com") ? "mercadopago" : url.startsWith("/billing/fake") ? "fake" : "unknown";
        trackEvent("ej_billing_checkout_redirect", { provider, flow: "card" });

        if (url.startsWith("http://") || url.startsWith("https://")) {
          window.location.assign(url);
          return;
        }

        router.push(url);
        return;
      }
      trackEvent("ej_billing_pix_generated", { flow: "annual_pix" });
      setPixInfo(data);
    },
    onError: () => {
      trackEvent("ej_billing_checkout_error");
    }
  });

  const confirmPix = useMutation({
    mutationFn: async () => {
      // Fake gateway confirmation (admin-only). When real PIX is integrated,
      // this button can be replaced by a "voltar" after provider confirmation.
      await api.post("/v1/billing/fake/confirm", null, {
        params: { plan: "plus_annual_pix", result: "succeeded" }
      });
    },
    onMutate: () => {
      trackEvent("ej_billing_pix_confirm_submit");
    },
    onSuccess: async () => {
      trackEvent("ej_billing_pix_confirm_success");
      setPixInfo(null);
      await status.refetch();
      router.replace(nextPath);
    },
    onError: () => {
      trackEvent("ej_billing_pix_confirm_error");
    }
  });

  const cancel = useMutation({
    mutationFn: async () => (await api.post("/v1/billing/cancel")).data,
    onMutate: () => {
      trackEvent("ej_billing_cancel_submit");
    },
    onSuccess: async () => {
      trackEvent("ej_billing_cancel_success");
      await status.refetch();
    },
    onError: () => {
      trackEvent("ej_billing_cancel_error");
    }
  });

  const loginHref = useMemo(() => {
    const current = `/billing?plan=${encodeURIComponent(planParam)}&next=${encodeURIComponent(nextPath)}`;
    return `/login?next=${encodeURIComponent(current)}`;
  }, [nextPath, planParam]);

  const showPlanChoice = planParam === "plus";

  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
      <Container className="py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/#planos"
            className={cn(
              "inline-flex items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur",
              "hover:bg-white/10 transition-colors duration-300",
              focusRing
            )}
          >
            Voltar para planos
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10">
              <Link href={nextPath}>Ir para o dashboard</Link>
            </Button>
          </div>
        </div>

        <header className="mt-8">
          <h1 className="text-3xl font-semibold">Billing</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Escolha o seu plano. Você pode começar no Free e ativar o Plus quando quiser.
          </p>
        </header>

        {me.isError ? (
          <Card className="mt-6 border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Faça login para continuar</CardTitle>
              <CardDescription className="text-white/70">
                Para assinar ou visualizar seu status de plano, entre com sua conta do escritório.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className={cn("w-full sm:w-auto", focusRing)}>
                <Link href={loginHref} onClick={() => trackEvent("ej_billing_login_click")}>
                  Ir para login
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {me.isSuccess ? (
          <Card className="mt-6 border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Sua assinatura</CardTitle>
                  <CardDescription className="text-white/70">
                    {status.data ? (
                      <>
                        Plano atual: <span className="font-semibold text-white">{planLabel(status.data.plan_code)}</span>
                      </>
                    ) : (
                      "Carregando status…"
                    )}
                  </CardDescription>
                </div>
                {status.data ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border border-white/15 bg-white/5 text-white/90",
                      status.data.status === "past_due" ? "border-amber-400/40 bg-amber-500/10" : null
                    )}
                  >
                    Status: {status.data.status}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              {status.data?.message ? (
                <div
                  className={cn(
                    "rounded-xl border border-white/10 bg-[#1e1c1e]/40 p-4 text-white/80",
                    status.data.status === "past_due" ? "border-amber-400/30 bg-amber-500/10" : null
                  )}
                >
                  {status.data.message}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Limite de clientes</p>
                  <p className="mt-1 text-sm text-white/80">
                    {status.data
                      ? status.data.limits.max_clients == null
                        ? "Ilimitado"
                        : status.data.limits.max_clients
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Armazenamento</p>
                  <p className="mt-1 text-sm text-white/80">
                    {status.data ? `${status.data.limits.max_storage_mb} MB` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Período</p>
                  <p className="mt-1 text-sm text-white/80">
                    {status.data?.status === "past_due"
                      ? `Acesso até: ${formatDateTimeBR(status.data.grace_period_end)}`
                      : `Até: ${formatDateTimeBR(status.data?.current_period_end)}`}
                  </p>
                </div>
              </div>

              {status.data?.plan_code === "PLUS_MONTHLY_CARD" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                    type="button"
                  >
                    {cancel.isPending ? "Cancelando…" : "Cancelar ao fim do período"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Checkout */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle>Plus Mensal (Cartão)</CardTitle>
              <CardDescription className="text-white/70">
                R$47/mês com renovação automática. Em caso de falha, há carência de 7 dias.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
                <li>Mais limites de usuários e armazenamento</li>
                <li>Prioridade no suporte</li>
                <li>Recursos avançados para crescer</li>
              </ul>

              <Button
                className={cn("w-full shadow-glow", focusRing)}
                onClick={() => startCheckout.mutate("plus_monthly_card")}
                disabled={!me.isSuccess || startCheckout.isPending}
                type="button"
              >
                {startCheckout.isPending ? "Iniciando…" : showPlanChoice || planParam.includes("monthly") || planParam.includes("card") ? "Assinar mensal (Cartão)" : "Assinar"}
              </Button>
              <p className="text-xs text-white/55">
                Checkout via provider (Mercado Pago/Stripe). Se estiver em FAKE, o fluxo é simulado.
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#234066]/50 bg-gradient-to-b from-[#234066]/20 to-white/5 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Plus Anual (Pix)</CardTitle>
                <Badge className="bg-[#234066] text-white">Economize</Badge>
              </div>
              <CardDescription className="text-white/70">R$499/ano. Renovação manual (gera nova cobrança).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
                <li>Plano completo para o escritório crescer</li>
                <li>Pagamento anual via Pix</li>
                <li>Economize pagando anual no Pix</li>
              </ul>

              <Button
                variant="outline"
                className={cn("w-full border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10", focusRing)}
                onClick={() => startCheckout.mutate("plus_annual_pix")}
                disabled={!me.isSuccess || startCheckout.isPending}
                type="button"
              >
                {startCheckout.isPending ? "Gerando Pix…" : "Gerar cobrança Pix anual"}
              </Button>

              {pixInfo?.pix_copy_paste ? (
                <div className="rounded-xl border border-white/10 bg-[#1e1c1e]/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Pix (copia e cola)</p>
                  <code className="mt-2 block select-all whitespace-pre-wrap break-words rounded bg-white/5 p-3 text-xs text-white/80">
                    {pixInfo.pix_copy_paste}
                  </code>
                  <div className="mt-3 text-xs text-white/60">
                    Expira em: {formatDateTimeBR(pixInfo.expires_at)}
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className={cn("w-full sm:w-auto", focusRing)}
                      onClick={() => confirmPix.mutate()}
                      disabled={confirmPix.isPending}
                      type="button"
                    >
                      {confirmPix.isPending ? "Confirmando…" : "Já paguei (simular)"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10 sm:w-auto"
                      onClick={() => setPixInfo(null)}
                      type="button"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-white/55">Cartão de crédito e outras formas disponíveis no checkout.</p>
            </CardContent>
          </Card>
        </div>
      </Container>
    </div>
  );
}
