type E2EEnv = {
  baseUrl: string;
  email: string;
  password: string;
  allowWrite: boolean;
  expectedTenantSlug?: string;
};

function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getE2EEnv(): E2EEnv {
  const baseUrl = (process.env.E2E_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

  if (baseUrl.includes("elementojuris.cloud")) {
    throw new Error(
      [
        "Blocked: E2E_BASE_URL points to a production domain.",
        `E2E_BASE_URL=${baseUrl}`,
        "",
        "Use localhost/staging instead.",
      ].join("\n")
    );
  }

  // Require explicit creds on non-local targets to avoid accidental login attempts.
  const fallbackEmail = isLocalBaseUrl(baseUrl) ? "admin@demo.example.com" : "";
  const fallbackPassword = isLocalBaseUrl(baseUrl) ? "admin12345" : "";

  const email = (process.env.E2E_EMAIL?.trim() || fallbackEmail).toLowerCase();
  const password = process.env.E2E_PASSWORD?.trim() || fallbackPassword;
  if (!email || !password) {
    throw new Error(
      [
        "Missing E2E credentials.",
        "Set E2E_EMAIL and E2E_PASSWORD (required for staging/CI).",
        "",
        "Local dev convenience (only for localhost):",
        "  E2E_EMAIL defaults to admin@demo.example.com",
        "  E2E_PASSWORD defaults to admin12345",
      ].join("\n")
    );
  }

  const allowWrite = (process.env.E2E_ALLOW_WRITE?.trim() || "false").toLowerCase() === "true";
  const expectedTenantSlug = process.env.E2E_TENANT?.trim() || undefined;

  return { baseUrl, email, password, allowWrite, expectedTenantSlug };
}

