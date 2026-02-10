export function formatCurrencyBRLFromCents(cents: number) {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseCurrencyToCents(input: string): number {
  // Keeps only digits, treats last 2 digits as cents.
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const cents = Number.parseInt(digits, 10);
  return Number.isFinite(cents) ? cents : 0;
}

export function maskCurrencyBRL(input: string): string {
  const cents = parseCurrencyToCents(input);
  return formatCurrencyBRLFromCents(cents);
}

export function centsToDecimalString(cents: number): string {
  const value = (cents / 100).toFixed(2);
  return value;
}

export { formatDateBR, formatDateTimeBR } from "./datetime";
