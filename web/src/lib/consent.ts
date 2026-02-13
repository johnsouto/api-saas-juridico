export const CONSENT_COOKIE = "ej_cookie_consent_v2";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
};

const DEFAULT_STATE: ConsentState = {
  necessary: true,
  analytics: false
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function setCookie(name: string, value: string, days: number) {
  if (!isBrowser()) return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function readConsent(): ConsentState | null {
  let storageRaw: string | null = null;
  if (isBrowser()) {
    try {
      storageRaw = window.localStorage.getItem(CONSENT_COOKIE);
    } catch {
      storageRaw = null;
    }
  }
  const raw = getCookie(CONSENT_COOKIE) || storageRaw;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState> | null;
    if (parsed && parsed.necessary === true && typeof parsed.analytics === "boolean") {
      return { necessary: true, analytics: parsed.analytics };
    }
  } catch {
    return null;
  }
  return null;
}

export function writeConsent(state: ConsentState) {
  const value = JSON.stringify(state);
  setCookie(CONSENT_COOKIE, value, 180);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(CONSENT_COOKIE, value);
    } catch {
      return;
    }
  }
}

export function clearConsent() {
  setCookie(CONSENT_COOKIE, "", -1);
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(CONSENT_COOKIE);
    } catch {
      return;
    }
  }
}

export function getDefaultConsent(): ConsentState {
  return DEFAULT_STATE;
}
