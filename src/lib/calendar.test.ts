import { describe, expect, it } from "vitest";
import { formatYear, formatYearRange, hijriEquivalents } from "./calendar";

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
});
