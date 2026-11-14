import { expect, test, type Page } from "@playwright/test";

// Next.js keeps the previous page in the DOM, hidden (React <Activity>), so
// every locator here looks at visible elements only.

/** Lane ids in the order they are on screen. */
const laneOrder = (page: Page) =>
  page.locator("[data-lane-id]:visible").evaluateAll((els) => els.map((el) => el.getAttribute("data-lane-id")));
const lane = (page: Page, id: string) => page.locator(`[data-lane-id="${id}"]:visible`);

test.describe("shareable URL (SH-2)", () => {
  test("restores year, lanes and anchor, with the anchor lane first", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk,russia,iran&anchor=ahmad-shah-qajar");
    await expect(page.getByRole("textbox", { name: "Year" })).toHaveValue("1919");
    await expect.poll(() => laneOrder(page)).toEqual(["iran", "uk", "russia"]);
    await expect(page.getByText("Anchored to Ahmad Shah Qajar")).toBeVisible();
    await expect(lane(page, "uk")).toContainText("George V");
    await expect(lane(page, "uk")).toContainText("David Lloyd George");
    await expect(lane(page, "russia")).toContainText("Vladimir Lenin");
  });

  test("redirects / to /en with the default lanes", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect.poll(() => laneOrder(page)).toEqual(["iran", "uk", "russia", "turkey"]);
  });
});

test.describe("time dock", () => {
  test("typing a year updates every lane and the URL", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk,germany");
    const field = page.getByRole("textbox", { name: "Year" });
    await field.fill("1941");
    await field.press("Enter");
    await expect(lane(page, "uk")).toContainText("George VI");
    await expect(lane(page, "germany")).toContainText("Adolf Hitler");
    await expect(page).toHaveURL(/year=1941/);
  });

  test("the slider moves by keyboard and announces all three calendars", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran");
    const slider = page.getByRole("slider", { name: "Selected year" });
    await slider.focus();
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "1920");
    await slider.press("Shift+ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuenow", "1910");
    await expect(slider).toHaveAttribute("aria-valuetext", /1910 Common Era, 1288–89 Solar Hijri, 1327–28 Lunar Hijri/);
    await slider.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "2026");
  });

  test("the reign step jumps to the next change of ruler", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran");
    await page.getByText("Reign", { exact: true }).click();
    await page.getByRole("button", { name: "Forward one step" }).click();
    await expect(page.getByRole("textbox", { name: "Year" })).toHaveValue("1925");
  });
});

test.describe("anchor (IN-4, TD-6)", () => {
  test("selecting a ruler anchors the comparison to their reign", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran,uk");
    await page.getByRole("button", { name: "George V, 1910–1936" }).click();
    await expect(page.getByText("Anchored to George V")).toBeVisible();
    await expect(page).toHaveURL(/anchor=george-v/);
    await expect.poll(() => laneOrder(page)).toEqual(["uk", "iran"]);

    await page.getByText("Whole reign").click();
    await expect(lane(page, "iran")).toContainText("Ahmad Shah Qajar");
    await expect(lane(page, "iran")).toContainText("Mohammad Ali Shah Qajar");

    await page.getByRole("button", { name: "Remove anchor" }).click();
    await expect(page).not.toHaveURL(/anchor=/);
  });
});

test.describe("small targets (WCAG 2.5.8)", () => {
  test("a reign too short to click can be anchored from the right column", async ({ page }) => {
    await page.goto("/en?year=1983&lanes=uk,russia");
    // Andropov's two years are a few pixels wide at full zoom, so not a button on the lane.
    await expect(lane(page, "russia").getByRole("button", { name: /^Yuri Andropov,/ })).toHaveCount(0);
    await lane(page, "russia").getByRole("button", { name: "Yuri Andropov", exact: true }).click();
    await expect(page.getByText("Anchored to Yuri Andropov")).toBeVisible();
    // Zoomed in, the same reign is wide enough to be a button again.
    await page.getByRole("button", { name: "Fit reign" }).click();
    await expect(lane(page, "russia").getByRole("button", { name: /^Yuri Andropov,/ })).toHaveCount(1);
  });
});

test.describe("add a country (AC-1 … AC-4)", () => {
  test("search, add with Enter, close with Escape", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran");
    const trigger = page.getByRole("button", { name: "Add country" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add a country" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("option", { name: /Turkey/ })).toContainText("Ottoman Empire · Sultan Mehmed VI");

    const search = dialog.getByRole("combobox");
    await search.fill("ژاپن");
    await search.press("Enter");
    await expect(dialog.getByText("2 of 10 lanes")).toBeVisible();
    await search.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Japan's data is fetched on demand.
    await expect(lane(page, "japan")).toContainText("Emperor Taishō");
    await expect(page).toHaveURL(/lanes=iran,japan/);
  });

  test("a preset replaces the lanes", async ({ page }) => {
    await page.goto("/en?year=1905&lanes=iran");
    await page.getByRole("button", { name: "Add country" }).click();
    await page.getByRole("button", { name: /Great powers, 1900s/ }).click();
    await expect.poll(() => laneOrder(page)).toEqual(["uk", "france", "germany", "russia", "japan"]);
  });
});

test.describe("politics card (PO-1)", () => {
  test("opens on focus and closes with Escape", async ({ page }) => {
    await page.goto("/en?year=1920&lanes=france");
    const pill = lane(page, "france").getByRole("button", { name: /^Third Republic/ });
    await pill.focus();
    const card = page.getByRole("tooltip");
    await expect(card).toContainText("Head of state in 1920");
    await expect(card).toContainText("Alexandre Millerand");
    await expect(card).toContainText("Head of government in 1920");
    await expect(card).toContainText("Parliamentary republic");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
  });
});

test.describe("zoom (IN-10)", () => {
  test("fit the reign, then show all", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran&anchor=ahmad-shah-qajar");
    await page.getByRole("button", { name: "Fit reign" }).click();
    await expect(page).toHaveURL(/from=\d+&to=\d+/);
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page).not.toHaveURL(/from=/);
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeFocused();
  });

  test("a year outside the window moves the window", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran&from=1910&to=1930");
    const field = page.getByRole("textbox", { name: "Year" });
    await field.fill("1980");
    await field.press("Enter");
    await expect(page).toHaveURL(/from=1970&to=1990/);
  });
});

test.describe("reorder lanes (IN-9)", () => {
  test("arrow keys move a lane and keep focus on its grip", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran,uk,russia");
    const grip = page.getByRole("button", { name: "Move Russia, lane 3 of 3" });
    await grip.focus();
    await grip.press("ArrowUp");
    await expect.poll(() => laneOrder(page)).toEqual(["iran", "russia", "uk"]);
    await expect(page.getByRole("button", { name: "Move Russia, lane 2 of 3" })).toBeFocused();
    await expect(page).toHaveURL(/lanes=iran,russia,uk/);
  });

  test("the anchored lane cannot be passed", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk,iran&anchor=george-v");
    await page.getByRole("button", { name: /^Move Iran/ }).press("ArrowUp");
    await expect.poll(() => laneOrder(page)).toEqual(["uk", "iran"]);
  });
});

test.describe("Persian (§8)", () => {
  test("right to left, Persian digits, and the comparison survives a language switch", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran,uk&anchor=ahmad-shah-qajar");
    await page.getByRole("link", { name: "فارسی" }).click();
    await expect(page).toHaveURL(/\/fa\?year=1919&lanes=iran,uk&anchor=ahmad-shah-qajar/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.getByRole("textbox", { name: "سال" })).toHaveValue("۱۹۱۹");
    await expect(lane(page, "iran")).toContainText("احمدشاه قاجار");
  });

  test("labels point at the visible page, not the hidden previous one", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran");
    await page.getByRole("link", { name: "فارسی" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    // The lane is named by its own Persian heading.
    await expect(page.getByRole("region", { name: /^ایران/ })).toBeVisible();
    const ids = await page.locator("[id]").evaluateAll((els) => els.map((el) => el.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});

test.describe("phone @phone", () => {
  test("no sideways scrolling and at most four lanes", async ({ page }) => {
    await page.goto("/en?year=1919");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.getByRole("button", { name: "Add country" }).click();
    await expect(page.getByRole("dialog").getByText("4 of 4 lanes")).toBeVisible();
  });
});
