import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * axe checks against WCAG 2.2 A and AA (PRD §9, goal 5) in each state a
 * reader reaches: the default view, an anchored comparison, the Add-country
 * dialog and the politics card, in English and Persian, on desktop and phone.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  // Report each violation with the elements it found, so a failure says what to fix.
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
  }));
  expect(summary).toEqual([]);
}

for (const locale of ["en", "fa"] as const) {
  test.describe(`${locale} @both`, () => {
    test("default view", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("[data-lane-id]:visible")).toHaveCount(4);
      await audit(page);
    });

    test("anchored and zoomed comparison, whole reign", async ({ page }) => {
      await page.goto(`/${locale}?year=1919&lanes=iran,uk,russia,germany&anchor=ahmad-shah-qajar&from=1905&to=1930`);
      await expect(page.locator("[data-lane-id]:visible")).toHaveCount(4);
      await page.locator("label:visible").filter({ has: page.locator('input[value="reign"]') }).first().click();
      await audit(page);
    });

    test("Add-country dialog", async ({ page }) => {
      await page.goto(`/${locale}?year=1919&lanes=iran`);
      await page.locator("button[aria-haspopup=dialog]:visible").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page);
    });

    test("politics card", async ({ page }) => {
      await page.goto(`/${locale}?year=1941&lanes=germany,france&from=1925&to=1955`);
      // Nazi Germany: its flag is withheld, so this also checks the placeholder (PO-4).
      await page
        .locator('[data-lane-id="germany"]:visible ol')
        .first()
        .getByRole("button", { name: locale === "en" ? /^Nazi Germany/ : /^آلمان نازی/ })
        .focus();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await audit(page);
    });
  });
}
