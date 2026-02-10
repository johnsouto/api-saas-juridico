export type AppTheme = "dark" | "light";

const STORAGE_KEY = "ej_theme";
const PREMIUM_CLASS = "theme-premium";

export function getStoredTheme(): AppTheme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function getEffectiveTheme(): AppTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains(PREMIUM_CLASS) ? "dark" : "light";
}

export function setTheme(theme: AppTheme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  const root = document.documentElement;
  if (theme === "dark") root.classList.add(PREMIUM_CLASS);
  else root.classList.remove(PREMIUM_CLASS);
}

export function initTheme(defaultTheme: AppTheme = "dark"): void {
  if (typeof window === "undefined") return;
  const stored = getStoredTheme() ?? defaultTheme;
  setTheme(stored);
}

