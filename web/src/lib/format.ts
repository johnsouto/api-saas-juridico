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

export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
  return `${date}, ${time}`;
}
