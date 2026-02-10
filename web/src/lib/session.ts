const LAST_ACTIVITY_KEY = "ej_last_activity_ts";
const IDLE_TIMEOUT_MS_KEY = "ej_idle_timeout_ms";

const DEFAULT_FREE_IDLE_MS = 12 * 60 * 60 * 1000; // 12h

function safeParseInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function touchActivity(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(nowMs));
}

export function setIdleTimeoutMs(ms: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(ms) || ms <= 0) return;
  window.localStorage.setItem(IDLE_TIMEOUT_MS_KEY, String(Math.floor(ms)));
}

export function getIdleTimeoutMs(): number {
  if (typeof window === "undefined") return DEFAULT_FREE_IDLE_MS;
  const stored = safeParseInt(window.localStorage.getItem(IDLE_TIMEOUT_MS_KEY));
  return stored && stored > 0 ? stored : DEFAULT_FREE_IDLE_MS;
}

export function isIdleExpired(nowMs: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const last = safeParseInt(window.localStorage.getItem(LAST_ACTIVITY_KEY));
  if (!last) {
    touchActivity(nowMs);
    return false;
  }
  return nowMs - last > getIdleTimeoutMs();
}

export function clearActivity(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
  window.localStorage.removeItem(IDLE_TIMEOUT_MS_KEY);
}

