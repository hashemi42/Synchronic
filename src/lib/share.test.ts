import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANE_HUES, laneColor, oklchToHex } from "./lane-colors";
import { describeComparison } from "./share";
import { parseTimelineParams, previewQuery } from "./url-params";

const state = (q: string) => parseTimelineParams(new URLSearchParams(q));

describe("link previews (NF-6)", () => {
  it("names the countries and the year", () => {
    const share = describeComparison(state("year=1919&lanes=iran,uk,russia"), "en")!;
    expect(share.title).toBe("Iran, United Kingdom, and Russia in 1919");
    expect(share.description).toContain("Iran: Qajar Iran, Ahmad Shah Qajar (Shah)");
    expect(share.lanes.map((l) => l.id)).toEqual(["iran", "uk", "russia"]);
    expect(share.year).toBe("1919");
    expect(share.yearSecondary).toBeNull();
  });

  it("leads with the anchor's lane and names the reign", () => {
    const share = describeComparison(state("year=1919&lanes=uk,iran&anchor=ahmad-shah-qajar"), "en")!;
    expect(share.lanes[0].id).toBe("iran");
    expect(share.title).toBe("Iran and United Kingdom during the reign of Ahmad Shah Qajar (1909–1925)");
  });

  it("writes Persian with Solar Hijri first", () => {
    const share = describeComparison(state("year=1919&lanes=iran,uk"), "fa")!;
    expect(share.title).toBe("ایران و بریتانیا در ۱۲۹۸ (۱۹۱۹ م)");
    expect(share.year).toBe("۱۲۹۸");
    expect(share.yearSecondary).toBe("۱۹۱۹ م");
  });

  it("shows at most four lanes in the image and counts the rest", () => {
    const share = describeComparison(state("year=1941&lanes=germany,uk,russia,japan,france,china"), "en")!;
    expect(share.lanes).toHaveLength(4);
    expect(share.more).toBe(2);
    expect(share.moreText).toBe("+2 more");
  });

  it("has nothing to say about unknown lanes", () => {
    expect(describeComparison(state("year=1919&lanes=atlantis"), "en")).toBeNull();
  });

  it("keeps only year, lanes and anchor in the image URL", () => {
    expect(previewQuery(state("year=1919&lanes=iran,uk&anchor=ahmad-shah-qajar&from=1900&to=1950"))).toBe(
      "year=1919&lanes=iran,uk&anchor=ahmad-shah-qajar",
    );
  });
});

describe("lane colours", () => {
  it("match the hues in globals.css", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/[locale]/globals.css"), "utf8");
    const hues = Object.fromEntries([...css.matchAll(/\[data-country="([a-z-]+)"\] \{ --hue: (\d+); \}/g)].map((m) => [m[1], Number(m[2])]));
    expect(hues).toEqual(LANE_HUES);
  });

  it("convert oklch to sRGB", () => {
    expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
    expect(laneColor("iran")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
