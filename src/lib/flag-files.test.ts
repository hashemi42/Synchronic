import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAllCountryFiles } from "./data/load";
import { FLAG_WIDTHS, flagPath, flagSlug, flagWidth } from "./flag-files";

describe("flag files", () => {
  it("turns Commons names into safe file stems", () => {
    expect(flagSlug("Flag of Japan (1870–1999).svg")).toBe("flag-of-japan-1870-1999");
    expect(flagSlug("Banner of the Holy Roman Emperor with haloes (1430-1806).svg")).toBe(
      "banner-of-the-holy-roman-emperor-with-haloes-1430-1806",
    );
    expect(flagSlug("Flag of Türkiye.svg")).toBe("flag-of-turkiye");
  });

  it("picks the smallest mirrored width that is wide enough", () => {
    expect(flagWidth(48)).toBe(96);
    expect(flagWidth(96)).toBe(96);
    expect(flagWidth(160)).toBe(320);
    expect(flagWidth(1000)).toBe(320);
    expect(flagPath("Flag of Russia.svg", 48)).toBe("/flags/flag-of-russia-96.png");
  });

  it("has no clashing names", () => {
    const files = [...new Set(getAllCountryFiles().flatMap((f) => f.flags.map((fl) => fl.file)))];
    expect(new Set(files.map(flagSlug)).size).toBe(files.length);
  });

  // `pnpm mirror:flags` fills public/flags. Withheld flags are deliberately not mirrored.
  it("mirrors every flag the data uses, except withheld ones", () => {
    const missing: string[] = [];
    for (const file of getAllCountryFiles())
      for (const flag of file.flags) {
        if (flag.withheld) continue;
        for (const width of FLAG_WIDTHS) {
          const target = path.join(process.cwd(), "public", flagPath(flag.file, width));
          if (!existsSync(target)) missing.push(path.relative(process.cwd(), target));
        }
      }
    expect([...new Set(missing)]).toEqual([]);
  });

  it("never mirrors a withheld flag", () => {
    for (const file of getAllCountryFiles())
      for (const flag of file.flags.filter((fl) => fl.withheld))
        for (const width of FLAG_WIDTHS)
          expect(existsSync(path.join(process.cwd(), "public", flagPath(flag.file, width)))).toBe(false);
  });
});
