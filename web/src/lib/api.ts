import axios from "axios";

import { clearPlatformAdminSession, getPlatformAdminKey, touchPlatformAdminActivity } from "@/lib/platformAuth";
import { isIdleExpired } from "@/lib/session";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export const api = axios.create({ baseURL });

// Used for auth-only requests to avoid interceptor recursion.
const authClient = axios.create({ baseURL });

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  // Do not attempt refresh loops on these endpoints.
  return (
    url.includes("/v1/auth/login") ||
    url.includes("/v1/auth/refresh") ||
    url.includes("/v1/auth/logout") ||
    url.includes("/v1/auth/register-tenant") ||
    url.includes("/v1/auth/accept-invite")
  );
}

function emitAuthFailed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("authFailed"));
}

function emitPlatformAuthFailed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("platformAuthFailed"));
}

function isPlatformEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/v1/platform") || url.startsWith("v1/platform");
}

function hasExplicitPlatformHeader(headers: unknown): boolean {
  if (!headers) return false;
  const maybeHeaders = headers as any;
  if (typeof maybeHeaders.get === "function") {
    return Boolean(maybeHeaders.get("x-platform-admin-key") || maybeHeaders.get("X-Platform-Admin-Key"));
  }
  return Boolean(maybeHeaders["x-platform-admin-key"] ?? maybeHeaders["X-Platform-Admin-Key"]);
}

api.interceptors.request.use((config) => {
  // Platform (super-admin) key used only by /v1/platform/* endpoints.
  const url = config.url ?? "";
  const isPlatform = isPlatformEndpoint(url);
  if (isPlatform) {
    if (hasExplicitPlatformHeader(config.headers)) return config;

    const platformKey = getPlatformAdminKey();
    if (!platformKey) {
      emitPlatformAuthFailed();
      return Promise.reject(new Error("Sessao da plataforma expirada. Faca login novamente."));
    }

    config.headers = config.headers ?? {};
    (config.headers as any)["x-platform-admin-key"] = platformKey;
    touchPlatformAdminActivity();
  }
  return config;
});

// Cookie-based session refresh (single-flight)
let refreshPromise: Promise<void> | null = null;

async function ensureRefreshed(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = authClient
      .post("/v1/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original || original.__isRetryRequest) throw error;

    const status = error.response?.status;
    const url = original.url as string | undefined;

    if (status === 401 && isPlatformEndpoint(url)) {
      clearPlatformAdminSession();
      emitPlatformAuthFailed();
      throw error;
    }

    if (status === 401 && !isAuthEndpoint(url)) {
      try {
        if (isIdleExpired()) {
          // Best-effort: clear cookies server-side.
          try {
            await authClient.post("/v1/auth/logout");
          } catch {
            // ignore
          }
          emitAuthFailed();
          throw error;
        }

        original.__isRetryRequest = true;
        await ensureRefreshed();
        return api.request(original);
      } catch {
        emitAuthFailed();
        throw error;
      }
    }

    throw error;
  }
);
