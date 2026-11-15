import { expect, test, type Page } from "@playwright/test";

/**
 * NF-1 budgets that Lighthouse does not check directly: initial JavaScript under 200 KB gzipped,
 * and scrubbing the year at 60 fps. Desktop only; frame timing on shared CI machines is noisy, so
 * the scrub check is a guard against regressions (a long task or a clearly slow median), not a
 * benchmark. `pnpm build && pnpm exec playwright test e2e/performance.spec.ts` prints the numbers.
 */

test("initial JavaScript is under 200 KB gzipped", async ({ page }) => {
  await page.goto("/en?year=1919&lanes=iran,uk,russia,turkey");
  await page.waitForLoadState("networkidle");
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => (r as PerformanceResourceTiming).initiatorType === "script" || r.name.endsWith(".js"))
      .reduce((sum, r) => sum + (r as PerformanceResourceTiming).encodedBodySize, 0),
  );
  console.log(`initial JS: ${(bytes / 1024).toFixed(1)} KB compressed`);
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThan(200 * 1024);
});

test("scrubbing the year keeps up with the display", async ({ page }) => {
  await page.goto("/en?year=1900&lanes=iran,uk,russia,turkey");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; long_: number[]; run_: boolean };
    w.frames_ = [];
    w.long_ = [];
    w.run_ = true;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.long_.push(e.duration))).observe({ type: "longtask" });
    let last = performance.now();
    const tick = (t: number) => {
      w.frames_.push(t - last);
      last = t;
      if (w.run_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const slider = page.getByRole("slider", { name: "Selected year" });
  const track = await slider.evaluate((el) => {
    const r = el.parentElement!.getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, width: r.width };
  });
  await page.mouse.move(track.x + 5, track.y);
  await page.mouse.down();
  for (let i = 0; i <= 120; i++) await page.mouse.move(track.x + 5 + (track.width - 10) * (i / 120), track.y);
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", /^20[12]\d$/);

  const result = await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; long_: number[]; run_: boolean };
    w.run_ = false;
    const frames = w.frames_.slice(2).sort((a, b) => a - b);
    return { frames: frames.length, median: frames[Math.floor(frames.length / 2)], p95: frames[Math.floor(frames.length * 0.95)], long: w.long_ };
  });
  console.log(`scrub: ${result.frames} frames, median ${result.median.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms, long tasks ${JSON.stringify(result.long.map(Math.round))}`);
  // 60 fps is a 16.7 ms frame; allow for timer jitter on shared machines.
  expect(result.median).toBeLessThan(20);
  expect(Math.max(0, ...result.long)).toBeLessThan(100);
});

/**
 * The cause of the long tasks on mid-range phones was building Intl formatters on every render
 * (300–600 per year step). This guards the cause directly: stepping the year builds none.
 */
for (const locale of ["en", "fa"] as const) {
  test(`stepping the year builds no new Intl formatters (${locale})`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { intlBuilt: number };
      w.intlBuilt = 0;
      for (const name of ["NumberFormat", "DateTimeFormat"] as const) {
        const Original = Intl[name];
        Intl[name] = new Proxy(Original, {
          construct(target, args) {
            w.intlBuilt++;
            return new (target as unknown as new (...a: unknown[]) => object)(...args);
          },
        }) as never;
      }
    });
    await page.goto(`/${locale}?year=1900&lanes=iran,uk,russia,turkey`);
    await page.waitForLoadState("networkidle");
    const slider = page.getByRole("slider").first();
    await slider.focus();
    await slider.press("ArrowRight"); // the first step may build the few formatters it reuses
    await page.evaluate(() => ((window as unknown as { intlBuilt: number }).intlBuilt = 0));
    for (let i = 0; i < 10; i++) await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "1911");
    expect(await page.evaluate(() => (window as unknown as { intlBuilt: number }).intlBuilt)).toBe(0);
  });
}

async function scrubWithFourTimesSlowerCpu(page: Page, locale: "en" | "fa") {
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`/${locale}?year=1900&lanes=iran,uk,russia,turkey`);
  await page.waitForLoadState("networkidle");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; long_: number[]; run_: boolean };
    w.frames_ = [];
    w.long_ = [];
    w.run_ = true;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.long_.push(e.duration))).observe({ type: "longtask" });
    let last = performance.now();
    const tick = (t: number) => {
      w.frames_.push(t - last);
      last = t;
      if (w.run_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const slider = page.getByRole("slider").first();
  const track = await slider.evaluate((el) => {
    const r = el.parentElement!.getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, width: r.width };
  });
  await page.mouse.move(track.x + 5, track.y);
  await page.mouse.down();
  for (let i = 0; i <= 120; i++) await page.mouse.move(track.x + 5 + (track.width - 10) * (i / 120), track.y);
  await page.mouse.up();
  const result = await page.evaluate(() => {
    const w = window as unknown as { frames_: number[]; long_: number[]; run_: boolean };
    w.run_ = false;
    const frames = w.frames_.slice(2).sort((a, b) => a - b);
    return {
      frames: frames.length,
      median: frames[Math.floor(frames.length / 2)],
      p95: frames[Math.floor(frames.length * 0.95)],
      late: frames.filter((f) => f > 33.4).length / frames.length,
      long: w.long_,
    };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return result;
}

for (const locale of ["en", "fa"] as const) {
  test(`scrubbing stays smooth with a four times slower CPU (${locale})`, async ({ page }) => {
    const result = await scrubWithFourTimesSlowerCpu(page, locale);
    console.log(
      `scrub 4x CPU ${locale}: ${result.frames} frames, median ${result.median.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms, ` +
        `${(result.late * 100).toFixed(1)}% of frames missed, long tasks ${JSON.stringify(result.long.map(Math.round))}`,
    );
    // Before the fix about 10% of frames were missed (p95 33 ms); after it, 1% or less.
    // Throttling stretches every task, so long-task counts are logged but not asserted.
    expect(result.median).toBeLessThan(20);
    expect(result.late).toBeLessThan(0.05);
  });
}
