export function onlyDigits(value: string): string {
  return (value || "").replace(/\D+/g, "");
}

export function formatCPF(input: string): string {
  const digits = onlyDigits(input).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  let out = part1;
  if (part2) out += `.${part2}`;
  if (part3) out += `.${part3}`;
  if (part4) out += `-${part4}`;
  return out;
}

export function formatCNPJ(input: string): string {
  const digits = onlyDigits(input).slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  let out = part1;
  if (part2) out += `.${part2}`;
  if (part3) out += `.${part3}`;
  if (part4) out += `/${part4}`;
  if (part5) out += `-${part5}`;
  return out;
}

export function formatPhoneBR(input: string): string {
  const digits = onlyDigits(input).slice(0, 11);
  const ddd = digits.slice(0, 2);
  const part1 = digits.slice(2, 7);
  const part2 = digits.slice(7, 11);

  let out = ddd ? `(${ddd})` : "";
  if (part1) out += ` ${part1}`;
  if (part2) out += `-${part2}`;
  return out.trim();
}

export function isValidCPFLength(value: string): boolean {
  return onlyDigits(value).length === 11;
}

export function isValidCNPJLength(value: string): boolean {
  return onlyDigits(value).length === 14;
}

export function isValidPhoneLength(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (digits.length >= 3 && digits[2] !== "9") return false;
  return true;
}
