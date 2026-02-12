const STORAGE_KEY = "platform_admin_key";
const SET_AT_KEY = "platform_admin_key_set_at";
const LAST_ACTIVITY_KEY = "platform_admin_last_activity_at";
const LEGACY_LOCAL_STORAGE_KEY = "platform_admin_key";

export const PLATFORM_KEY_TTL_MS = 8 * 60 * 60 * 1000;
export const PLATFORM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

type ExpiryReason = "missing" | "invalid" | "ttl" | "idle";

function safeParseInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nowMs(): number {
  return Date.now();
}

function migrateLegacyKeyToSession() {
  if (typeof window === "undefined") return;
  const current = window.sessionStorage.getItem(STORAGE_KEY);
  if (current) return;

  const legacy = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  if (!legacy) return;

  const now = nowMs();
  window.sessionStorage.setItem(STORAGE_KEY, legacy);
  window.sessionStorage.setItem(SET_AT_KEY, String(now));
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
}

export function clearPlatformAdminSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(SET_AT_KEY);
  window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function clearPlatformAdminKey() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function lockPlatformAdminSession() {
  clearPlatformAdminKey();
}

export function setPlatformAdminKey(value: string) {
  if (typeof window === "undefined") return;
  const now = nowMs();
  window.sessionStorage.setItem(STORAGE_KEY, value);
  window.sessionStorage.setItem(SET_AT_KEY, String(now));
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function touchPlatformAdminActivity(now: number = nowMs()) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function getPlatformSessionState(now: number = nowMs()): { valid: boolean; reason?: ExpiryReason } {
  if (typeof window === "undefined") return { valid: false, reason: "missing" };

  migrateLegacyKeyToSession();

  const key = window.sessionStorage.getItem(STORAGE_KEY);
  if (!key) return { valid: false, reason: "missing" };

  const setAt = safeParseInt(window.sessionStorage.getItem(SET_AT_KEY));
  const lastActivity = safeParseInt(window.sessionStorage.getItem(LAST_ACTIVITY_KEY));

  if (!setAt || !lastActivity) {
    window.sessionStorage.setItem(SET_AT_KEY, String(now));
    window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    return { valid: true };
  }

  if (now - setAt > PLATFORM_KEY_TTL_MS) {
    clearPlatformAdminSession();
    return { valid: false, reason: "ttl" };
  }

  if (now - lastActivity > PLATFORM_IDLE_TIMEOUT_MS) {
    clearPlatformAdminSession();
    return { valid: false, reason: "idle" };
  }

  return { valid: true };
}

export function getPlatformAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  const state = getPlatformSessionState();
  if (!state.valid) return null;
  return window.sessionStorage.getItem(STORAGE_KEY);
}
