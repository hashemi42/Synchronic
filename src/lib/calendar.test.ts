import { describe, expect, it } from "vitest";
import { displayRange, displayYear, formatYear, formatYearRange, gregorianRange, headlineYear, hijriEquivalents, solarHijriYear, tickPositions } from "./calendar";

describe("calendar equivalents", () => {
  it("matches the PRD example: 1919 CE · 1297–98 SH · 1337–38 AH", () => {
    const eq = hijriEquivalents(1919)!;
    expect(formatYearRange(eq.sh, "en")).toBe("1297–98");
    expect(formatYearRange(eq.ah, "en")).toBe("1337–38");
  });

  it("uses Persian digits in the Persian UI", () => {
    expect(formatYear(1919, "fa")).toBe("۱۹۱۹");
    expect(formatYearRange(hijriEquivalents(1919)!.sh, "fa")).toBe("۱۲۹۷–۹۸");
  });

  it("writes both years in full across a century boundary", () => {
    expect(formatYearRange({ from: 1299, to: 1300 }, "en")).toBe("1299–1300");
  });

  it("has no Hijri equivalent for BCE years and drops the sign", () => {
    expect(hijriEquivalents(-500)).toBeNull();
    expect(formatYear(-500, "en")).toBe("500");
  });

  describe("Solar Hijri headline (L-4)", () => {
    it("is the Solar Hijri year in force on 1 July, for every year in range", () => {
      for (let y = 1789; y <= 2026; y++) {
        const july = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", timeZone: "UTC" })
          .formatToParts(new Date(Date.UTC(y, 6, 1)))
          .find((p) => p.type === "year")!.value;
        expect(solarHijriYear(y)).toBe(Number(july));
      }
    });

    it("leads with Solar Hijri only in the Persian UI, and only after the Hijra", () => {
      expect(headlineYear(1919, "fa")).toEqual({ calendar: "sh", value: 1298 });
      expect(headlineYear(1919, "en")).toEqual({ calendar: "ce", value: 1919 });
      expect(headlineYear(-500, "fa")).toEqual({ calendar: "ce", value: -500 });
      expect(solarHijriYear(622)).toBeNull();
    });
  });
});

describe("display years (L-4)", () => {
  it("leaves English untouched", () => {
    expect(displayYear(1919, "en")).toBe("1919");
    expect(displayRange({ start: 1919, end: 1925 }, "en", "today")).toBe("1919–1925");
    expect(gregorianRange({ start: 1919, end: 1925 }, "en", "today")).toBeNull();
    expect(displayRange({ start: 1990, end: null }, "en", "today")).toBe("1990–today");
  });

  it("leads with Solar Hijri in Persian and offers the Gregorian years as secondary", () => {
    expect(displayYear(1919, "fa")).toBe("۱۲۹۸");
    expect(displayRange({ start: 1919, end: 1925 }, "fa", "اکنون")).toBe("۱۲۹۸–۱۳۰۴");
    expect(gregorianRange({ start: 1919, end: 1925 }, "fa", "اکنون")).toBe("۱۹۱۹–۱۹۲۵");
    expect(displayRange({ start: 1979, end: null }, "fa", "اکنون")).toBe("۱۳۵۸–اکنون");
    expect(displayRange({ start: 1941, end: 1941 }, "fa", "اکنون")).toBe("۱۳۲۰");
  });

  it("falls back to Gregorian before the Hijra", () => {
    expect(displayYear(500, "fa")).toBe("۵۰۰");
    expect(gregorianRange({ start: 500, end: 600 }, "fa", "x")).toBeNull();
  });

  it("puts Persian ticks on round Solar Hijri years at their Gregorian positions", () => {
    const ticks = tickPositions({ from: 1900, to: 1950 }, 10, "fa");
    expect(ticks[0]).toEqual({ pos: 1901, value: 1280 });
    expect(ticks.every((t) => t.value % 10 === 0 && t.pos === t.value + 621)).toBe(true);
    expect(tickPositions({ from: 1900, to: 1950 }, 10, "en")[0]).toEqual({ pos: 1900, value: 1900 });
  });
});
