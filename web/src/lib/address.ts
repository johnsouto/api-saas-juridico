type AddressInput = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

function formatZipForAddress(zip: string): string {
  const digits = zip.replace(/\D+/g, "").slice(0, 8);
  if (digits.length !== 8) return zip;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatFullAddress(input: AddressInput): string {
  const street = input.street?.trim() ?? "";
  const number = input.number?.trim() ?? "";
  const complement = input.complement?.trim() ?? "";
  const neighborhood = input.neighborhood?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  const zip = input.zip?.trim() ?? "";

  const streetPart = street ? `${street}${number ? `, nº ${number}` : ""}` : "";
  const complementPart = complement ? `, ${complement}` : "";
  const neighborhoodPart = neighborhood ? ` - ${neighborhood}` : "";

  const cityStatePart = city || state ? `${city}${city && state ? "/" : ""}${state}` : "";
  const zipPart = zip ? formatZipForAddress(zip) : "";

  const left = `${streetPart}${complementPart}${neighborhoodPart}`.trim();
  const right = [cityStatePart, zipPart].filter(Boolean).join(", ");

  if (left && right) return `${left}, ${right}`;
  if (left) return left;
  if (right) return right;
  return "-";
}
