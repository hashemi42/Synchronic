import { describe, expect, it } from "vitest";
import { clampYear, parseYearInput, stepYear } from "./time";

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
