"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getPlatformSessionState, setPlatformAdminKey } from "@/lib/platformAuth";

function normalizeNextPath(value: string | null): string {
  if (!value) return "/platform";
  if (!value.startsWith("/platform")) return "/platform";
  return value;
}

function reasonMessage(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "idle") return "Sessão expirada por inatividade. Informe a chave novamente.";
  if (reason === "ttl") return "Sessão expirada por tempo de uso. Informe a chave novamente.";
  if (reason === "locked") return "Sessão travada. Informe a chave para destravar.";
  if (reason === "unauthorized") return "Acesso inválido. Informe a chave novamente.";
  return null;
}

export default function PlatformLoginPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [nextPath, setNextPath] = useState("/platform");
  const [reason, setReason] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (platformKey: string) => {
      await api.get("/v1/platform/ping", {
        headers: {
          "x-platform-admin-key": platformKey
        }
      });
    },
    onSuccess: (_, platformKey) => {
      const normalized = platformKey.trim();
      setPlatformAdminKey(normalized);
      router.replace(nextPath);
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNextPath(normalizeNextPath(params.get("next")));
      setReason(params.get("reason"));
    }

    const state = getPlatformSessionState();
    if (state.valid) {
      router.replace("/platform");
    }
  }, [router]);

  const helperMessage = useMemo(() => reasonMessage(reason), [reason]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Acesso administrativo</CardTitle>
          <CardDescription>Por segurança, a chave expira por inatividade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {helperMessage ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">{helperMessage}</p> : null}

          <div className="space-y-1">
            <Label htmlFor="platform_key">Chave de administrador</Label>
            <Input
              id="platform_key"
              type="password"
              placeholder="Informe a chave"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
            />
            Lembrar nesta sessão
          </label>

          <Button
            className="w-full"
            disabled={mutation.isPending || !key.trim()}
            onClick={() => mutation.mutate(key)}
            type="button"
          >
            {mutation.isPending ? "Validando..." : "Entrar"}
          </Button>

          {mutation.isError ? (
            <p className="text-sm text-destructive">
              {((mutation.error as any)?.response?.status ?? 0) === 401
                ? "Chave inválida. Verifique e tente novamente."
                : "Não foi possível validar a chave agora. Tente novamente."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
