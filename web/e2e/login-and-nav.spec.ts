import type { Locator, Page } from "@playwright/test";

import { getE2EEnv } from "./env";
import { test, expect } from "./fixtures";

async function preemptCockpitModal(page: Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("ej_cockpit_shown", "1");
    } catch {
      // ignore
    }
  });
}

async function uiLogin(page: Page) {
  const env = getE2EEnv();

  await preemptCockpitModal(page);
  await page.goto("/login");

  await page.locator("#login_email").fill(env.email);
  await page.locator("#login_senha").fill(env.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // /dashboard -> redirects to /dashboard/:slug
  await page.waitForURL(/\/dashboard(\/.*)?$/, { timeout: 30_000 });
  await page.waitForURL(/\/dashboard\/[^/]+(\/.*)?$/, { timeout: 30_000 });

  if (env.expectedTenantSlug) {
    await expect(page).toHaveURL(new RegExp(`/dashboard/${env.expectedTenantSlug}(/|$)`));
  }
}

async function assertPageLoadedOrEmpty({
  page,
  title,
  emptyText,
  nonEmptyIndicator,
}: {
  page: Page;
  title: string;
  emptyText: string;
  nonEmptyIndicator: Locator;
}) {
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(emptyText, { exact: true }).or(nonEmptyIndicator)).toBeVisible();
}

test.describe("E2E smoke (read-only)", () => {
  test("login and navigate main modules", async ({ page }) => {
    await uiLogin(page);

    // Sidebar links are rendered in /dashboard/:slug layout.
    const nav = async (label: string) => {
      await page.getByRole("link", { name: label, exact: true }).click();
    };

    await nav("Clientes");
    await assertPageLoadedOrEmpty({
      page,
      title: "Clientes",
      emptyText: "Nenhum cliente cadastrado ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });

    await nav("Parcerias");
    await assertPageLoadedOrEmpty({
      page,
      title: "Parcerias",
      emptyText: "Nenhuma parceria cadastrada ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });

    await nav("Processos");
    await assertPageLoadedOrEmpty({
      page,
      title: "Processos",
      emptyText: "Nenhum processo cadastrado ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });

    await nav("Honorários");
    await assertPageLoadedOrEmpty({
      page,
      title: "Honorários",
      emptyText: "Nenhum honorário cadastrado ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });

    await nav("Agenda");
    await assertPageLoadedOrEmpty({
      page,
      title: "Agenda",
      emptyText: "Nenhum evento cadastrado ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });

    await nav("Tarefas");
    const tarefasHeading = page.getByRole("heading", { name: "Tarefas", exact: true });
    const tarefasPlusLockHeading = page.getByRole("heading", { name: "Disponível no Plano Plus", exact: true });
    await expect(tarefasHeading).toBeVisible();

    if (await tarefasPlusLockHeading.isVisible()) {
      await expect(page.getByRole("link", { name: "Assinar Plus", exact: true })).toBeVisible();
    } else {
      await assertPageLoadedOrEmpty({
        page,
        title: "Tarefas",
        emptyText: "Nenhuma tarefa cadastrada ainda.",
        nonEmptyIndicator: page.locator("div.text-xs.font-semibold", { hasText: "pendente" }),
      });
    }

    await nav("Documentos");
    await assertPageLoadedOrEmpty({
      page,
      title: "Documentos",
      emptyText: "Nenhum documento cadastrado ainda.",
      nonEmptyIndicator: page.getByRole("table"),
    });
  });
});
