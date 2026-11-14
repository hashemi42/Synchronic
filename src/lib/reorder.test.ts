import { describe, expect, it } from "vitest";
import { moveBy, moveTo } from "./reorder";

const lanes = ["iran", "uk", "russia", "turkey"];

describe("moveTo", () => {
  it("moves an item to a new index", () => {
    expect(moveTo(lanes, "turkey", 1)).toEqual(["iran", "turkey", "uk", "russia"]);
    expect(moveTo(lanes, "iran", 3)).toEqual(["uk", "russia", "turkey", "iran"]);
  });

  it("clamps to the ends", () => {
    expect(moveTo(lanes, "uk", 99)).toEqual(["iran", "russia", "turkey", "uk"]);
    expect(moveTo(lanes, "uk", -5)).toEqual(["uk", "iran", "russia", "turkey"]);
  });

  it("keeps pinned items first", () => {
    expect(moveTo(lanes, "turkey", 0, 1)).toEqual(["iran", "turkey", "uk", "russia"]);
    expect(moveTo(lanes, "iran", 2, 1)).toEqual(lanes);
  });

  it("ignores unknown ids", () => {
    expect(moveTo(lanes, "japan", 0)).toEqual(lanes);
  });
});

describe("moveBy", () => {
  it("moves one place", () => {
    expect(moveBy(lanes, "russia", -1)).toEqual(["iran", "russia", "uk", "turkey"]);
    expect(moveBy(lanes, "russia", 1)).toEqual(["iran", "uk", "turkey", "russia"]);
  });

  it("stops at the ends and below the pinned item", () => {
    expect(moveBy(lanes, "turkey", 1)).toEqual(lanes);
    expect(moveBy(lanes, "uk", -1, 1)).toEqual(lanes);
  });
});
