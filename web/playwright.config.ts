import { defineConfig, devices } from "@playwright/test";

function failIfProductionTarget(baseUrl: string) {
  // Golden rule: never run E2E against production domains.
  // Keep this check intentionally simple and strict.
  if (baseUrl.includes("elementojuris.cloud")) {
    throw new Error(
      [
        "Refusing to run Playwright E2E against a production domain.",
        `E2E_BASE_URL=${baseUrl}`,
        "",
        "Set E2E_BASE_URL to localhost/staging (e.g. http://localhost:3000).",
      ].join("\n")
    );
  }
}

const baseURL = process.env.E2E_BASE_URL?.trim() || "http://localhost:3000";
failIfProductionTarget(baseURL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

