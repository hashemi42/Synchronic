import { describe, expect, it } from "vitest";
import { clampYear, followYear, frame, isFullRange, MIN_SPAN, panWindow, parseYearInCalendar, parseYearInput, stepYear, ticksFor, zoomWindow } from "./time";

const range = { from: -500, to: 2026 };

describe("stepYear", () => {
  it("moves by year, decade and century", () => {
    expect(stepYear(1919, 1, "year", { range })).toBe(1920);
    expect(stepYear(1919, -1, "decade", { range })).toBe(1909);
    expect(stepYear(1919, -1, "century", { range })).toBe(1819);
  });

  it("moves ten steps with Shift", () => {
    expect(stepYear(1919, 1, "year", { range, times: 10 })).toBe(1929);
  });

  it("skips the missing year 0", () => {
    expect(stepYear(1, -1, "year", { range })).toBe(-1);
    expect(stepYear(-1, 1, "year", { range })).toBe(1);
    expect(stepYear(5, -1, "decade", { range })).toBe(-6);
  });

  it("clamps to the range", () => {
    expect(stepYear(2020, 1, "decade", { range })).toBe(2026);
    expect(stepYear(-450, -1, "century", { range })).toBe(-500);
  });

  it("jumps between reigns", () => {
    const boundaries = [1909, 1848, 1896, 1907, 1925];
    expect(stepYear(1919, 1, "reign", { boundaries, range })).toBe(1925);
    expect(stepYear(1919, -1, "reign", { boundaries, range })).toBe(1909);
    expect(stepYear(1909, -1, "reign", { boundaries, range })).toBe(1907);
    expect(stepYear(1925, 1, "reign", { boundaries, range })).toBe(2026);
  });
});

describe("clampYear", () => {
  it("never returns 0", () => {
    expect(clampYear(0, range)).toBe(1);
    expect(clampYear(3000, range)).toBe(2026);
  });
});

describe("parseYearInput", () => {
  it("reads Latin and Persian digits", () => {
    expect(parseYearInput("1919")).toBe(1919);
    expect(parseYearInput(" ۱۹۱۹ ")).toBe(1919);
    expect(parseYearInput("1919 CE")).toBe(1919);
  });

  it("reads BCE years", () => {
    expect(parseYearInput("500 BCE")).toBe(-500);
    expect(parseYearInput("-500")).toBe(-500);
    expect(parseYearInput("۵۰۰ پ.م")).toBe(-500);
  });

  it("rejects text and year 0", () => {
    expect(parseYearInput("Qajar")).toBeNull();
    expect(parseYearInput("0")).toBeNull();
    expect(parseYearInput("")).toBeNull();
  });
});

describe("zoom window", () => {
  const all = { from: 1789, to: 2026 };

  it("halves around the focus year and keeps it in place", () => {
    const next = zoomWindow(all, 0.5, 1919, all);
    expect(next.to - next.from + 1).toBe(119);
    const before = (1919 - all.from) / 238;
    const after = (1919 - next.from) / 119;
    expect(Math.abs(before - after)).toBeLessThan(0.01);
  });

  it("never goes below the minimum span or past the range", () => {
    const tiny = zoomWindow({ from: 1900, to: 1915 }, 0.1, 1910, all);
    expect(tiny.to - tiny.from + 1).toBe(MIN_SPAN);
    expect(zoomWindow({ from: 1900, to: 1950 }, 100, 1925, all)).toEqual(all);
    expect(zoomWindow({ from: 2000, to: 2026 }, 0.5, 2026, all).to).toBe(2026);
  });

  it("pans within the range", () => {
    expect(panWindow({ from: 1900, to: 1949 }, 30, all)).toEqual({ from: 1930, to: 1979 });
    expect(panWindow({ from: 1900, to: 1949 }, 500, all)).toEqual({ from: 1977, to: 2026 });
    expect(panWindow({ from: 1900, to: 1949 }, -500, all)).toEqual({ from: 1789, to: 1838 });
  });

  it("follows a year that leaves the window", () => {
    const view = { from: 1900, to: 1949 };
    expect(followYear(view, 1920, all)).toBe(view);
    expect(followYear(view, 1990, all)).toEqual({ from: 1965, to: 2014 });
  });

  it("frames a reign with a margin", () => {
    const f = frame({ start: 1909, end: 1925 }, all);
    expect(f.from).toBeLessThan(1909);
    expect(f.to).toBeGreaterThan(1925);
    expect(isFullRange(f, all)).toBe(false);
    expect(isFullRange(all, all)).toBe(true);
  });

  it("chooses denser ticks for narrower windows", () => {
    expect(ticksFor({ from: 1910, to: 1920 }).step).toBe(1);
    expect(ticksFor(all).labelEvery).toBe(50);
  });
});

describe("parseYearInCalendar (L-4)", () => {
  it("reads a bare number in the field's own calendar", () => {
    expect(parseYearInCalendar("1298", "sh")).toBe(1919);
    expect(parseYearInCalendar("۱۲۹۸", "sh")).toBe(1919);
    expect(parseYearInCalendar("1919", "ce")).toBe(1919);
  });

  it("lets an explicit marker override it, either way", () => {
    expect(parseYearInCalendar("۱۹۱۹ م", "sh")).toBe(1919);
    expect(parseYearInCalendar("1919 CE", "sh")).toBe(1919);
    expect(parseYearInCalendar("۱۹۱۹ میلادی", "sh")).toBe(1919);
    expect(parseYearInCalendar("۱۲۹۸ ه.ش", "ce")).toBe(1919);
    expect(parseYearInCalendar("1298 SH", "ce")).toBe(1919);
    expect(parseYearInCalendar("۱۲۹۸ خورشیدی", "ce")).toBe(1919);
  });

  it("keeps BCE as Gregorian and rejects nonsense", () => {
    expect(parseYearInCalendar("۵۰۰ پ.م", "sh")).toBe(-500);
    expect(parseYearInCalendar("500 BCE", "sh")).toBe(-500);
    expect(parseYearInCalendar("abc", "sh")).toBeNull();
    expect(parseYearInCalendar("0", "sh")).toBeNull();
  });
});
