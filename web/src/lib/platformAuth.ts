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

function readSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function removeSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeLocal(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

function migrateLegacyKeyToSession() {
  if (typeof window === "undefined") return;
  const current = readSession(STORAGE_KEY);
  if (current) return;

  const legacy = readLocal(LEGACY_LOCAL_STORAGE_KEY);
  if (!legacy) return;

  const now = nowMs();
  writeSession(STORAGE_KEY, legacy);
  writeSession(SET_AT_KEY, String(now));
  writeSession(LAST_ACTIVITY_KEY, String(now));
  removeLocal(LEGACY_LOCAL_STORAGE_KEY);
}

export function clearPlatformAdminSession() {
  removeSession(STORAGE_KEY);
  removeSession(SET_AT_KEY);
  removeSession(LAST_ACTIVITY_KEY);
}

export function clearPlatformAdminKey() {
  removeSession(STORAGE_KEY);
}

export function lockPlatformAdminSession() {
  clearPlatformAdminKey();
}

export function setPlatformAdminKey(value: string) {
  const now = nowMs();
  writeSession(STORAGE_KEY, value);
  writeSession(SET_AT_KEY, String(now));
  writeSession(LAST_ACTIVITY_KEY, String(now));
}

export function touchPlatformAdminActivity(now: number = nowMs()) {
  writeSession(LAST_ACTIVITY_KEY, String(now));
}

export function getPlatformSessionState(now: number = nowMs()): { valid: boolean; reason?: ExpiryReason } {
  if (typeof window === "undefined") return { valid: false, reason: "missing" };

  migrateLegacyKeyToSession();

  const key = readSession(STORAGE_KEY);
  if (!key) return { valid: false, reason: "missing" };

  const setAt = safeParseInt(readSession(SET_AT_KEY));
  const lastActivity = safeParseInt(readSession(LAST_ACTIVITY_KEY));

  if (!setAt || !lastActivity) {
    writeSession(SET_AT_KEY, String(now));
    writeSession(LAST_ACTIVITY_KEY, String(now));
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
  return readSession(STORAGE_KEY);
}
