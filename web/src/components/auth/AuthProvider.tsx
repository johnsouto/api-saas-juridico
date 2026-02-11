"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { cleanupLegacySaaSTokens, logout as apiLogout } from "@/lib/auth";
import { clearActivity, touchActivity } from "@/lib/session";

export type AuthUser = {
  id: string;
  tenant_id: string;
  nome: string;
  first_name?: string | null;
  last_name?: string | null;
  oab_number?: string | null;
  email: string;
  role: "admin" | "advogado" | "financeiro";
  is_active: boolean;
  criado_em: string;
};

export type AuthTenant = {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo_documento: "cpf" | "cnpj";
  documento: string;
  slug: string;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  criado_em: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [forcedUnauth, setForcedUnauth] = useState(false);

  useEffect(() => {
    cleanupLegacySaaSTokens();
  }, []);

  useEffect(() => {
    // Client-side "idle timeout" support: record last activity timestamp.
    // Tokens stay HttpOnly (no auth in JS); this is only a timestamp to force re-login after long inactivity.
    let lastTouch = 0;
    const touch = () => {
      const now = Date.now();
      // Throttle writes to localStorage.
      if (now - lastTouch < 5000) return;
      lastTouch = now;
      touchActivity(now);
    };

    touch();

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousemove", touch, opts);
    window.addEventListener("keydown", touch);
    window.addEventListener("click", touch, opts);
    window.addEventListener("scroll", touch, opts);
    document.addEventListener("visibilitychange", touch);

    return () => {
      window.removeEventListener("mousemove", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("click", touch);
      window.removeEventListener("scroll", touch);
      document.removeEventListener("visibilitychange", touch);
    };
  }, []);

  useEffect(() => {
    function onAuthFailed() {
      clearActivity();
      setForcedUnauth(true);
      qc.removeQueries({ queryKey: ["auth-me"] });
      qc.removeQueries({ queryKey: ["auth-tenant"] });
    }
    window.addEventListener("authFailed", onAuthFailed);
    return () => window.removeEventListener("authFailed", onAuthFailed);
  }, [qc]);

  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => (await api.get<AuthUser>("/v1/auth/me")).data,
    retry: false,
    refetchOnWindowFocus: false
  });

  const tenant = useQuery({
    queryKey: ["auth-tenant"],
    queryFn: async () => (await api.get<AuthTenant>("/v1/tenants/me")).data,
    enabled: me.isSuccess,
    retry: false,
    refetchOnWindowFocus: false
  });

  const status: AuthStatus = useMemo(() => {
    if (forcedUnauth) return "unauthenticated";
    if (me.isLoading) return "loading";
    if (me.isError) return "unauthenticated";
    if (tenant.isLoading) return "loading";
    if (tenant.isError) return "unauthenticated";
    return "authenticated";
  }, [forcedUnauth, me.isError, me.isLoading, tenant.isError, tenant.isLoading]);

  const refreshSession = async () => {
    setForcedUnauth(false);
    await Promise.all([me.refetch(), tenant.refetch()]);
  };

  const logout = async () => {
    await apiLogout();
    clearActivity();
    setForcedUnauth(true);
    qc.removeQueries({ queryKey: ["auth-me"] });
    qc.removeQueries({ queryKey: ["auth-tenant"] });
  };

  const value: AuthContextValue = {
    status,
    user: me.data ?? null,
    tenant: tenant.data ?? null,
    refreshSession,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}
