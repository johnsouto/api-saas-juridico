import { api } from "@/lib/api";

// Legacy localStorage keys used by the old JWT-in-localStorage implementation.
// We keep a cleanup step to avoid confusion when upgrading deployments.
const LEGACY_ACCESS_KEY = "saas_access_token";
const LEGACY_REFRESH_KEY = "saas_refresh_token";

export function cleanupLegacySaaSTokens(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_ACCESS_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_KEY);
  } catch {
    // ignore
  }
}

export async function loginWithEmailSenha(input: { email: string; senha: string }): Promise<void> {
  const body = new URLSearchParams();
  body.set("username", input.email);
  body.set("password", input.senha);
  body.set("grant_type", "password");

  await api.post("/v1/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
}

export async function registerTenant(input: {
  tenant_nome: string;
  tenant_tipo_documento: "cpf" | "cnpj";
  tenant_documento: string;
  tenant_slug: string;
  admin_nome: string;
  admin_email: string;
  admin_senha: string;
}): Promise<void> {
  await api.post("/v1/auth/register-tenant", input);
}

export async function logout(): Promise<void> {
  try {
    await api.post("/v1/auth/logout");
  } finally {
    cleanupLegacySaaSTokens();
  }
}

