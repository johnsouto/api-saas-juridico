import { defineConfig, devices } from "@playwright/test";

function normalizeBaseUrl(input: string): string {
  return (input || "").trim().replace(/\/+$/, "");
}

function assertSafeBaseUrl(baseUrl: string): void {
  const value = baseUrl.toLowerCase();
  if (!value) throw new Error("E2E_BASE_URL is empty. Refusing to run E2E tests.");

  // Golden rule: never run E2E against production.
  // IMPORTANT: keep this check simple and explicit. Do not add an override.
  if (value.includes("elementojuris.cloud")) {
    throw new Error(
      [
        "Refusing to run Playwright E2E against a production domain.",
        `E2E_BASE_URL=${baseUrl}`,
        "",
        "Set E2E_BASE_URL to localhost or a dedicated staging environment.",
      ].join("\n"),
    );
  }
}

const baseURL = normalizeBaseUrl(process.env.E2E_BASE_URL ?? "http://localhost:3000");
assertSafeBaseUrl(baseURL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  outputDir: "artifacts/e2e/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/e2e/playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    // We manage trace/screenshot in ./e2e/fixtures.ts to keep artifacts in:
    // - artifacts/e2e/screenshots
    // - artifacts/e2e/traces
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
