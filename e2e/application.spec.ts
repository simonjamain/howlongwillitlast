import { test, expect } from "@playwright/test";
test("create, measure, forecast, edit, localize and reset a board", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Nouveau tableau", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  const name = "Cuve de fioul " + info.project.name + " " + Date.now();
  await dialog.getByRole("textbox", { name: "Nom", exact: true }).fill(name);
  await dialog.getByRole("textbox", { name: "Unité", exact: true }).fill("cm");
  await dialog.getByRole("button", { name: "Créer le tableau" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Données insuffisantes" }),
  ).toHaveCount(2);
  const now = Date.now();
  const local = (at: number) => {
    const d = new Date(at);
    return new Date(at - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 19);
  };
  const form = page.locator("#reading-form");
  for (const [offset, value] of [
    [-4, 100],
    [-1, 70],
  ] as const) {
    await form
      .locator('input[type="datetime-local"]')
      .fill(local(now + offset * 86400000));
    await form.getByRole("spinbutton").fill(String(value));
    await form
      .getByRole("button", { name: "Ajouter un relevé", exact: true })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(value === 100 ? 1 : 2);
  }
  await expect(
    page.getByText("jours estimés restants", { exact: true }),
  ).toHaveCount(2);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: info.outputPath("board.png"), fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await form.getByRole("spinbutton").fill("65");
  await form.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("65");
  await page.getByRole("checkbox", { name: "Linéaire · 5 derniers" }).uncheck();
  await expect(
    page.getByText("jours estimés restants", { exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Linéaire · 5 derniers" }),
  ).not.toBeChecked();
  await page.getByRole("combobox", { name: "Langue" }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Forecasts", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("fr");
  await page
    .getByRole("button", { name: "Effacer les relevés", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Annuler", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Effacer les relevés", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Effacer tous les relevés", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
