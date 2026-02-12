import { expect, test as base } from "@playwright/test";

function safeFileSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  return slug.slice(0, 80) || "test";
}

export const test = base;
export { expect };

test.beforeEach(async ({ context }) => {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
});

test.afterEach(async ({ context, page }, testInfo) => {
  const failed = testInfo.status !== testInfo.expectedStatus;
  if (!failed) {
    await context.tracing.stop();
    return;
  }

  const fileBase = safeFileSlug(`${testInfo.title}`);

  // Best-effort artifacts. Never throw from hooks.
  try {
    await page.screenshot({
      path: testInfo.outputPath("screenshots", `${fileBase}.png`),
      fullPage: true,
    });
  } catch {}

  try {
    await context.tracing.stop({
      path: testInfo.outputPath("traces", `${fileBase}.zip`),
    });
  } catch {
    try {
      await context.tracing.stop();
    } catch {}
  }
});

