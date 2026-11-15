import { describe, expect, it } from "vitest";
import { shapeLine, visualRuns } from "./og-text";

describe("link-preview text shaping (NF-6)", () => {
  it("orders a Persian line right to left, keeping numbers left to right", () => {
    const runs = visualRuns("احمدشاه قاجار ۱۹۰۹", "rtl");
    // Visual order, left to right: the number first, then the Persian words.
    expect(runs[0].text).toBe("۱۹۰۹");
    expect(runs.at(-1)!.text).toContain("احمدشاه");
  });

  it("puts brackets around a number inside right-to-left text in the right runs", () => {
    // On screen, left to right: a bracket, the number, a bracket, then قاجار. Both brackets stay in
    // right-to-left runs, where harfbuzz mirrors them so each faces the number.
    expect(visualRuns("قاجار (۱۲۸۸)", "rtl")).toEqual([
      { level: 1, text: ")" },
      { level: 2, text: "۱۲۸۸" },
      { level: 1, text: "قاجار (" },
    ]);
  });

  it("draws text as paths with a measured width, and shortens what does not fit", async () => {
    const full = await shapeLine("پادشاهی متحد بریتانیای کبیر و ایرلند", { size: 24 });
    expect(full.svg).toMatch(/^<svg[^>]+width="\d+"/);
    expect(full.svg).toContain("<path");
    expect(full.width).toBeGreaterThan(200);
    const short = await shapeLine("پادشاهی متحد بریتانیای کبیر و ایرلند", { size: 24, maxWidth: 160 });
    expect(short.width).toBeLessThanOrEqual(160);
    const latin = await shapeLine("Iran", { size: 24, dir: "ltr", weight: 700 });
    expect(latin.width).toBeGreaterThan(20);
  });
});
