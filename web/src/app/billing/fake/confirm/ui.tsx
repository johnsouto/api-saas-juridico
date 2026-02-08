"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Container } from "@/components/landing/Container";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#234066] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1e2b]";

function resolveNext(nextValue: string | null): { kind: "path" | "url"; value: string } {
  if (!nextValue) return { kind: "path", value: "/dashboard" };
  const v = nextValue.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return { kind: "url", value: v };
  if (!v.startsWith("/") || v.startsWith("//")) return { kind: "path", value: "/dashboard" };
  return { kind: "path", value: v };
}

export default function FakeCheckoutConfirmUI() {
  const router = useRouter();
  const search = useSearchParams();

  const flow = search.get("flow") ?? "card";
  const externalId = search.get("sub");
  const nextTarget = useMemo(() => resolveNext(search.get("next")), [search]);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/v1/auth/me")).data as { nome: string; email: string; role: string },
    retry: false
  });

  const approve = useMutation({
    mutationFn: async () => {
      await api.post("/v1/billing/fake/confirm", null, {
        params: { plan: "plus_monthly_card", result: "succeeded", external_id: externalId ?? undefined }
      });
    },
    onSuccess: () => {
      if (nextTarget.kind === "url") {
        window.location.href = nextTarget.value;
      } else {
        router.replace(nextTarget.value);
      }
    }
  });

  const fail = useMutation({
    mutationFn: async () => {
      await api.post("/v1/billing/fake/confirm", null, {
        params: { plan: "plus_monthly_card", result: "failed", external_id: externalId ?? undefined }
      });
    },
    onSuccess: () => {
      router.replace("/billing?plan=plus_monthly_card&next=/dashboard");
    }
  });

  if (me.isError) {
    const current = `/billing/fake/confirm?flow=${encodeURIComponent(flow)}&sub=${encodeURIComponent(externalId ?? "")}&next=${encodeURIComponent(
      search.get("next") ?? "/dashboard"
    )}`;
    return (
      <div className="theme-premium min-h-screen bg-background text-foreground">
        <Container className="py-12">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Faça login para continuar</CardTitle>
              <CardDescription className="text-white/70">
                Este checkout é uma simulação do gateway. Você precisa estar logado como admin do escritório.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className={cn("w-full sm:w-auto", focusRing)}>
                <Link href={`/login?next=${encodeURIComponent(current)}`}>Ir para login</Link>
              </Button>
            </CardContent>
          </Card>
        </Container>
      </div>
    );
  }

  return (
    <div className="theme-premium min-h-screen bg-background text-foreground">
      <Container className="py-10">
        <Link
          href="/billing?plan=plus&next=/dashboard"
          className={cn(
            "inline-flex items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur",
            "hover:bg-white/10 transition-colors duration-300",
            focusRing
          )}
        >
          Voltar ao billing
        </Link>

        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">Checkout (Fake)</h1>
            <Badge className="bg-[#234066] text-white">Simulação</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Este fluxo existe apenas para testar a arquitetura do billing antes de integrar Stripe/Mercado Pago.
          </p>
        </header>

        <Card className="mt-6 border-white/10 bg-white/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Plus Mensal (Cartão)</CardTitle>
            <CardDescription className="text-white/70">
              Confirme o pagamento para ativar o Plus. Você também pode simular uma falha para testar carência (PAST_DUE).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <div className="rounded-xl border border-white/10 bg-[#1e1c1e]/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Detalhes</p>
              <div className="mt-2 grid grid-cols-1 gap-1">
                <div>Flow: {flow}</div>
                <div className="break-words">external_id: {externalId ?? "—"}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className={cn("w-full sm:w-auto shadow-glow", focusRing)}
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                type="button"
              >
                {approve.isPending ? "Confirmando…" : "Aprovar pagamento"}
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-foreground/90 hover:bg-white/10 sm:w-auto"
                onClick={() => fail.mutate()}
                disabled={fail.isPending}
                type="button"
              >
                {fail.isPending ? "Enviando…" : "Simular falha"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}

