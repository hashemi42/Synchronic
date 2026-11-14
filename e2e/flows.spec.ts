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
    await expect(page.getByRole("textbox", { name: "سال هجری خورشیدی" })).toHaveValue("۱۲۹۸");
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

test.describe("Persian leads with Solar Hijri (L-4) @both", () => {
  const field = (page: Page) => page.getByRole("textbox", { name: "سال هجری خورشیدی" });

  test("shows the Solar Hijri year first and the Gregorian year beside it", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=iran");
    await expect(field(page)).toHaveValue("۱۲۹۸");
    const dock = page.getByRole("region", { name: "کنترل‌های زمان" });
    await expect(dock).toContainText("ه‍.ش");
    await expect(dock).toContainText("۱۹۱۹ م");
    await expect(dock).toContainText("ه‍.ق");
    // English keeps Gregorian first.
    await page.goto("/en?year=1919&lanes=iran");
    await expect(page.getByRole("textbox", { name: "Year" })).toHaveValue("1919");
  });

  test("a typed year is read as Solar Hijri unless marked, and the URL stays Gregorian", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=uk");
    await field(page).fill("۱۳۲۰");
    await field(page).press("Enter");
    await expect(page).toHaveURL(/year=1941/);
    await expect(field(page)).toHaveValue("۱۳۲۰");
    await field(page).fill("۱۹۲۰ م");
    await field(page).press("Enter");
    await expect(page).toHaveURL(/year=1920/);
    await expect(field(page)).toHaveValue("۱۲۹۹");
    await field(page).fill("۱۳۰۰ ه.ش");
    await field(page).press("Enter");
    await expect(page).toHaveURL(/year=1921/);
  });

  test("the slider announces Solar Hijri first and still steps by keyboard", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=iran");
    const slider = page.getByRole("slider", { name: "سال انتخاب‌شده" });
    await expect(slider).toHaveAttribute("aria-valuetext", /^۱۲۹۸ هجری خورشیدی، ?۱۹۱۹ میلادی/);
    await slider.focus();
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "1920");
    await expect(field(page)).toHaveValue("۱۲۹۹");
  });
});

test.describe("Persian dates are Solar Hijri everywhere (L-4) @both", () => {
  test("lanes, cards and the axis lead with Solar Hijri; English is unchanged", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=iran");
    const iran = lane(page, "iran");
    // Ahmad Shah Qajar, 1909–1925: Solar Hijri first, Gregorian after it.
    await expect(iran).toContainText("۱۲۸۸–۱۳۰۴");
    await expect(iran).toContainText("۱۹۰۹–۱۹۲۵ م");
    // The pill and ruler names carry both for screen readers.
    // (A button's label, or hidden text where the segment is too narrow to be a button.)
    await expect(
      iran.locator('[aria-label*="۱۲۸۸–۱۳۰۴ (۱۹۰۹–۱۹۲۵ م)"], .sr-only:has-text("۱۲۸۸–۱۳۰۴ (۱۹۰۹–۱۹۲۵ م)")').first(),
    ).toBeAttached();
    // The axis counts in Solar Hijri; the zoom label too.
    await expect(page.getByText("۱۱۶۸–۱۴۰۵")).toBeVisible();
    expect(await page.locator(".year").allTextContents()).toContain("۱۳۰۰");

    await page.goto("/en?year=1919&lanes=iran");
    await expect(lane(page, "iran")).toContainText("1909–1925");
    await expect(lane(page, "iran")).not.toContainText("ه‍.ش");
    expect(await page.locator(".year").allTextContents()).toContain("1900");
  });

  test("the politics card and world row use the same format", async ({ page }) => {
    await page.goto("/fa?year=1941&lanes=germany&from=1925&to=1955");
    await expect(page.locator("[data-world-row]:visible")).toContainText("۱۳۱۸–۱۳۲۴"); // 1939–1945
    await lane(page, "germany").getByRole("button", { name: /^آلمان نازی/ }).focus();
    const card = page.getByRole("tooltip");
    await expect(card).toContainText("۱۳۱۲–۱۳۲۴ · ۱۹۳۳–۱۹۴۵ م");
  });
});

test.describe("alternative governments (IN-6) @both", () => {
  test("a +1 badge opens the rival government and closes again", async ({ page }) => {
    await page.goto("/en?year=1920&lanes=china");
    const badge = lane(page, "china").getByRole("button", { name: /^\+1\s*Also at this time/ });
    await expect(badge).toHaveAttribute("aria-expanded", "false");
    await expect(lane(page, "china").getByText("Guangzhou government")).toBeHidden();
    await badge.click();
    await expect(badge).toHaveAttribute("aria-expanded", "true");
    await expect(lane(page, "china").getByText(/Guangzhou government/)).toBeVisible();
    await badge.click();
    await expect(lane(page, "china").getByText(/Guangzhou government/)).toBeHidden();
  });

  test("works from the keyboard, and has no badge when nothing competed", async ({ page }) => {
    await page.goto("/en?year=1920&lanes=china,uk");
    await expect(lane(page, "uk").getByRole("button", { name: /Also at this time/ })).toHaveCount(0);
    const badge = lane(page, "china").getByRole("button", { name: /Also at this time/ });
    await badge.focus();
    await page.keyboard.press("Enter");
    await expect(badge).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(badge).toHaveAttribute("aria-expanded", "false");
    await page.goto("/en?year=1930&lanes=china");
    await expect(lane(page, "china").getByRole("button", { name: /Also at this time/ })).toHaveCount(0);
  });

  test("reads right to left in Persian, with Persian digits", async ({ page }) => {
    await page.goto("/fa?year=1920&lanes=china");
    const badge = lane(page, "china").getByRole("button", { name: /^\+۱\s*هم‌زمان/ });
    await badge.click();
    await expect(lane(page, "china").getByText(/گوانگ‌ژو/).first()).toBeVisible();
  });
});

test.describe("spelling variants in search (L-6) @both", () => {
  const search = async (page: Page, trigger: string, query: string) => {
    await page.getByRole("button", { name: trigger }).click();
    const box = page.getByRole("dialog").getByRole("combobox");
    await box.fill(query);
    return page.getByRole("dialog").getByRole("option");
  };

  test("Ghajar and Qajar find Iran, Teheran finds it by its capital", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    for (const q of ["Ghajar", "Qajar", "Teheran"]) {
      const options = await search(page, "Search countries", q);
      await expect(options).toHaveCount(1);
      await expect(options.first()).toContainText("Iran");
      await page.keyboard.press("Escape");
    }
  });

  test("a spelling that matches nothing says so instead of guessing", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const options = await search(page, "Search countries", "Xyzzy");
    await expect(options).toHaveCount(0);
  });

  test("Latin spellings also work from the Persian page", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=uk");
    const options = await search(page, "جست‌وجوی کشور", "Ghajar");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("ایران");
    await page.keyboard.press("Enter");
    await expect.poll(() => laneOrder(page)).toContain("iran");
  });
});

test.describe("top bar (SH-1) @both", () => {
  test("the search trigger opens the Add-country dialog and focus comes back", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const trigger = page.getByRole("button", { name: "Search countries" });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox")).toBeFocused();
    await dialog.getByRole("combobox").fill("japan");
    await page.keyboard.press("Enter");
    await expect.poll(() => laneOrder(page)).toContain("japan");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Ctrl+K and ⌘K open the same dialog", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "needs a hardware keyboard");
    await page.goto("/en?year=1919&lanes=uk");
    await page.getByRole("heading", { name: "World history, side by side" }).click();
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.keyboard.press("Meta+K");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("the view switch shows the map as coming soon and does nothing", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const view = page.getByRole("group", { name: "View" });
    await expect(view.getByText("Infographic")).toHaveAttribute("aria-current", "page");
    const map = view.getByRole("button", { name: /^Map/ });
    await expect(map).toHaveAttribute("aria-disabled", "true");
    await expect(map).toHaveAccessibleDescription("Coming soon");
    await map.click({ force: true });
    await expect(page).toHaveURL(/\/en\?/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("links to the repository in a new tab, safely", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const link = page.getByRole("link", { name: /Synchronic on GitHub/ });
    await expect(link).toHaveAttribute("href", /^https:\/\/github\.com\/[^/]+\/Synchronic$/);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("in Persian everything is translated, reads right to left, and fits", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=uk");
    await expect(page.getByRole("button", { name: "جست‌وجوی کشور" })).toBeVisible();
    await expect(page.getByRole("group", { name: "نما" }).getByText("اینفوگرافیک")).toBeVisible();
    await expect(page.getByRole("button", { name: /^نقشه/ })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("link", { name: /در گیت‌هاب/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.getByRole("button", { name: "جست‌وجوی کشور" }).click();
    await page.getByRole("dialog").getByRole("combobox").fill("ژاپن");
    await page.keyboard.press("Enter");
    await expect.poll(() => laneOrder(page)).toContain("japan");
  });

  test("the bar keeps every control reachable by keyboard, in a sensible order", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const order: string[] = [];
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      order.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim() ?? ""));
    }
    expect(order.join("|")).toMatch(/Synchronic[\s\S]*Map[\s\S]*Search countries[\s\S]*English[\s\S]*GitHub/);
  });
});

test.describe("self-hosted assets @both", () => {
  test("a page makes no request to another site, and every flag loads", async ({ page }) => {
    const foreign: string[] = [];
    const failed: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith("http://localhost")) foreign.push(r.url());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/en?year=1919&lanes=iran,uk,russia,turkey,china,japan");
    await page.getByRole("button", { name: /^Nazi Germany|^Qajar Iran/ }).first().focus();
    await page.waitForLoadState("networkidle");
    // Lazy flags load as they scroll in; bring them all in view.
    await page.evaluate(async () => {
      for (const img of document.querySelectorAll<HTMLImageElement>("img[loading=lazy]")) img.loading = "eager";
    });
    await page.waitForLoadState("networkidle");
    const flags = page.locator("img[src^='/flags/']");
    expect(await flags.count()).toBeGreaterThan(5);
    const broken = await flags.evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length);
    expect(broken).toBe(0);
    expect(foreign).toEqual([]);
    expect(failed).toEqual([]);
  });

  test("the politics card shows its flag from our own origin", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=iran");
    await lane(page, "iran").getByRole("button", { name: /^ایران قاجاری/ }).focus();
    const flag = page.getByRole("tooltip").locator("img");
    await expect(flag).toHaveAttribute("src", /^\/flags\/.+-320\.png$/);
    await expect.poll(() => flag.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  });

  test("the favicon is served and linked", async ({ page, request }) => {
    await page.goto("/en?year=1919&lanes=iran");
    await expect(page.locator('link[rel="icon"][href="/icon.svg"]')).toHaveCount(1);
    expect((await request.get("/favicon.ico")).status()).toBe(200);
    expect((await request.get("/icon.svg")).status()).toBe(200);
    expect((await request.get("/apple-touch-icon.png")).status()).toBe(200);
  });
});

test.describe("era strip and detail track (TD-2) @both", () => {
  const strip = (page: Page) => page.locator("[data-era-strip]:visible");
  const slider = (page: Page, name: string) => page.getByRole("slider", { name });

  test("the strip shows the first lane's dynasties; pressing one jumps to its start", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran,uk");
    await expect(strip(page)).toHaveAttribute("aria-label", /Iran/);
    await expect(strip(page).getByRole("button", { name: /^Jump to Qajar Iran/ })).toHaveAttribute("aria-current", "true");
    await strip(page).getByRole("button", { name: /^Jump to Pahlavi Iran, 1925/ }).click();
    await expect(page).toHaveURL(/year=1925/);
    await expect(slider(page, "Selected year")).toHaveAttribute("aria-valuenow", "1925");
    await expect(strip(page).getByRole("button", { name: /^Jump to Pahlavi Iran/ })).toHaveAttribute("aria-current", "true");
  });

  test("it follows the anchor's country, and works from the keyboard", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    await expect(strip(page)).toHaveAttribute("aria-label", /United Kingdom/);
    await page.goto("/en?year=1919&lanes=uk,iran&anchor=ahmad-shah-qajar");
    await expect(strip(page)).toHaveAttribute("aria-label", /Iran/);
    const era = strip(page).getByRole("button", { name: /^Jump to Islamic Republic of Iran/ });
    await era.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/year=1979/);
  });

  test("eras too narrow to press are drawn but are not buttons", async ({ page }) => {
    // At 500 px the five-year Russian SFSR (1917–22) is about 9 px wide, however fonts or scrollbars render.
    await page.setViewportSize({ width: 500, height: 900 });
    await page.goto("/en?year=1919&lanes=russia");
    await expect(strip(page).locator("li")).toHaveCount(4);
    await expect(strip(page).getByRole("button")).toHaveCount(3);
    await expect(strip(page).getByRole("button", { name: /Russian SFSR/ })).toHaveCount(0);
  });

  test("the detail track appears only while zoomed, counts the window, and scrubs", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=iran");
    await expect(page.locator("[data-detail-track]:visible")).toHaveCount(0);
    await page.goto("/en?year=1919&lanes=iran&from=1900&to=1950");
    const track = page.locator("[data-detail-track]:visible");
    await expect(track).toHaveAttribute("aria-hidden", "true");
    await expect(track.getByText("1920", { exact: true })).toBeVisible();
    const box = (await track.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await expect(page).toHaveURL(/year=19(24|25|26)/);
    await expect(slider(page, "Selected year")).toHaveAttribute("aria-valuenow", /19(24|25|26)/);
  });

  test("in Persian: Solar Hijri on the era labels and the detail track, names in Persian", async ({ page }) => {
    await page.goto("/fa?year=1919&lanes=iran&from=1900&to=1950");
    await expect(strip(page)).toHaveAttribute("aria-label", /ایران/);
    await expect(strip(page).getByRole("button", { name: /^پرش به ایران پهلوی، ۱۳۰۴–/ })).toBeVisible();
    await expect(page.locator("[data-detail-track]:visible").getByText("۱۳۰۰", { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

test.describe("floating time dock on phones @phone", () => {
  test("an era can be tapped on a tall phone and is left out of a short one", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en?year=1919&lanes=iran");
    await page.locator("[data-era-strip]:visible").getByRole("button", { name: /^Jump to Pahlavi Iran/ }).tap();
    await expect(page).toHaveURL(/year=1925/);
    await page.setViewportSize({ width: 375, height: 600 });
    await expect(page.locator("[data-era-strip]:visible")).toHaveCount(0);
  });

  const dockOf = (page: Page) => page.getByRole("region", { name: /Time controls/ });

  for (const height of [568, 667, 812]) {
    test(`the last lane stays above the dock at the end of the page (${height} px tall)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height });
      await page.goto("/en?year=1919&lanes=iran,uk,russia,turkey");
      await expect(lane(page, "turkey")).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const laneBox = (await lane(page, "turkey").boundingBox())!;
      const dockBox = (await dockOf(page).boundingBox())!;
      expect(laneBox.y + laneBox.height).toBeLessThanOrEqual(dockBox.y);
      // The dock is compact: under 35% of even a short screen.
      expect(dockBox.height / height).toBeLessThan(0.35);
    });
  }

  test("keyboard focus is never left under the dock", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/fa?year=1919&lanes=iran,uk,russia,turkey");
    await expect(page.getByRole("region", { name: /کنترل‌های زمان/ })).toBeVisible();
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press("Tab");
      const covered = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const dock = document.querySelector("section[class*=sticky]");
        if (!a || !dock || dock.contains(a) || a === document.body) return false;
        const r = a.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        return r.height > 2 && r.bottom > d.top + 1 && r.top < d.bottom;
      });
      expect(covered, `Tab ${i + 1}`).toBe(false);
    }
  });

  test("on a short landscape screen the dock stops floating", async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/en?year=1919&lanes=iran,uk");
    await expect(dockOf(page)).toHaveCSS("position", "static");
  });
});

test.describe("phone @phone", () => {
  test("the top bar's search is a 40 px touch target that opens with a tap", async ({ page }) => {
    await page.goto("/en?year=1919&lanes=uk");
    const trigger = page.getByRole("button", { name: "Search countries" });
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await trigger.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("the +1 badge opens with a tap", async ({ page }) => {
    await page.goto("/en?year=1920&lanes=china");
    const badge = lane(page, "china").getByRole("button", { name: /Also at this time/ });
    await badge.tap();
    await expect(lane(page, "china").getByText(/Guangzhou government/)).toBeVisible();
    const box = await badge.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test("no sideways scrolling and at most four lanes", async ({ page }) => {
    await page.goto("/en?year=1919");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.getByRole("button", { name: "Add country" }).click();
    await expect(page.getByRole("dialog").getByText("4 of 4 lanes")).toBeVisible();
  });
});
