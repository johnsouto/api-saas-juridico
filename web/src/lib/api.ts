import axios from "axios";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth";
import { getPlatformAdminKey } from "@/lib/platformAuth";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api"
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Platform (super-admin) key used only by /v1/platform/* endpoints.
  const platformKey = getPlatformAdminKey();
  if (platformKey) {
    config.headers = config.headers ?? {};
    (config.headers as any)["x-platform-admin-key"] = platformKey;
  }
  return config;
});

// Minimal refresh-token flow (best-effort)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original || original.__isRetryRequest) {
      throw error;
    }

    if (error.response?.status === 401) {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        throw error;
      }

      try {
        original.__isRetryRequest = true;
        const r = await axios.post(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api"}/v1/auth/refresh`,
          { refresh_token: refresh }
        );
        setTokens(r.data);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${r.data.access_token}`;
        return api.request(original);
      } catch {
        clearTokens();
        throw error;
      }
    }

    throw error;
  }
);
