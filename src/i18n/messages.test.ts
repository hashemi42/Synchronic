import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fa from "../../messages/fa.json";

const keys = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe("UI messages", () => {
  it("has the same keys in English and Persian", () => {
    expect(keys(fa).sort()).toEqual(keys(en).sort());
  });
});
