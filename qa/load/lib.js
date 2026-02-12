import http from "k6/http";
import { check, sleep } from "k6";

export const PROD_BLOCK_SUBSTR = "elementojuris.cloud";

function requireEnv(name) {
  const v = (__ENV[name] || "").trim();
  if (!v) {
    throw new Error(
      [
        `Missing ${name}.`,
        "Load tests must target localhost/staging only.",
        "",
        `Example: ${name}=http://localhost`,
      ].join("\n")
    );
  }
  return v.replace(/\/+$/, "");
}

function isLocalHost(baseUrl) {
  const host = baseUrl
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

export function getTargetBaseUrl() {
  const baseUrl = requireEnv("QA_TARGET_BASE_URL");
  if (baseUrl.includes(PROD_BLOCK_SUBSTR)) {
    throw new Error(
      [
        "Blocked: refusing to run k6 against a production domain.",
        `QA_TARGET_BASE_URL=${baseUrl}`,
        "",
        "Point it to localhost/staging instead.",
      ].join("\n")
    );
  }
  return baseUrl;
}

export function getProfileOptions() {
  const profile = (__ENV.K6_PROFILE || "smoke").trim().toLowerCase();
  const allowDangerous = (__ENV.QA_ALLOW_DANGEROUS || "false").trim().toLowerCase() === "true";

  if (profile === "stress" && !allowDangerous) {
    throw new Error(
      [
        "Blocked: K6_PROFILE=stress requires explicit opt-in.",
        "Set QA_ALLOW_DANGEROUS=true to enable stress tests.",
      ].join("\n")
    );
  }

  if (profile === "smoke") return { vus: 2, duration: "30s" };
  if (profile === "load") return { vus: 10, duration: "60s" };
  if (profile === "stress") return { vus: 50, duration: "120s" };

  throw new Error(`Invalid K6_PROFILE=${profile} (use smoke|load|stress).`);
}

export function getCreds(baseUrl) {
  const localFallbackEmail = isLocalHost(baseUrl) ? "admin@demo.example.com" : "";
  const localFallbackPassword = isLocalHost(baseUrl) ? "admin12345" : "";

  const email = (__ENV.K6_EMAIL || localFallbackEmail).trim().toLowerCase();
  const password = (__ENV.K6_PASSWORD || localFallbackPassword).trim();

  if (!email || !password) {
    throw new Error(
      [
        "Missing K6 credentials.",
        "Set K6_EMAIL and K6_PASSWORD (required for staging/CI).",
        "",
        "Local dev convenience (only for localhost):",
        "  K6_EMAIL defaults to admin@demo.example.com",
        "  K6_PASSWORD defaults to admin12345",
      ].join("\n")
    );
  }

  return { email, password };
}

export function login(baseUrl, email, password) {
  const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const r = http.post(`${baseUrl}/api/v1/auth/login`, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  check(r, {
    "login status 200": (res) => res.status === 200,
    "login ok=true": (res) => {
      try {
        return res.json("ok") === true;
      } catch {
        return false;
      }
    },
  });

  return r;
}

export function listClients(baseUrl) {
  const r = http.get(`${baseUrl}/api/v1/clients`);
  check(r, { "clients status 200": (res) => res.status === 200 });
  return r;
}

export function listProcesses(baseUrl) {
  const r = http.get(`${baseUrl}/api/v1/processes`);
  check(r, { "processes status 200": (res) => res.status === 200 });
  return r;
}

export function exportOverviewXlsx(baseUrl) {
  const r = http.get(`${baseUrl}/api/v1/reports/overview.xlsx`, {
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
  check(r, { "export status 200": (res) => res.status === 200 });
  return r;
}

export function uploadSmallDocument(baseUrl) {
  const allowWrite = (__ENV.K6_ALLOW_WRITE || "false").trim().toLowerCase() === "true";
  if (!allowWrite) {
    throw new Error("Blocked: upload scenario requires K6_ALLOW_WRITE=true (opt-in).");
  }

  const payload = { file: http.file("hello", "hello.txt", "text/plain") };
  const r = http.post(`${baseUrl}/api/v1/documents/upload`, payload);
  check(r, { "upload status 200": (res) => res.status === 200 });
  return r;
}

export function pace() {
  sleep(0.2);
}

