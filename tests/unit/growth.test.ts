import { describe, expect, it } from "vitest";
import {
  advanceGarden,
  projectPlant,
  type CatalogPlant,
} from "../../src/features/garden/domain/growth";

const catalog: readonly CatalogPlant[] = Object.freeze([
  Object.freeze({ id: "cherry", slotIndex: 3, unlockAt: 30 }),
  Object.freeze({ id: "clover", slotIndex: 0, unlockAt: 0 }),
  Object.freeze({ id: "sunflower", slotIndex: 2, unlockAt: 15 }),
  Object.freeze({ id: "daisy", slotIndex: 1, unlockAt: 5 }),
]);

describe("advanceGarden", () => {
  it.each([
    [0, 1, []],
    [3, 4, []],
    [4, 5, ["daisy"]],
    [5, 6, []],
    [13, 14, []],
    [14, 15, ["sunflower"]],
    [15, 16, []],
    [28, 29, []],
    [29, 30, ["cherry"]],
    [30, 31, []],
  ])(
    "advances %i → %i and unlocks exactly %j",
    (previous, nextTotal, newlyEligiblePlantIds) => {
      expect(advanceGarden(previous, catalog)).toEqual({
        nextTotal,
        newlyEligiblePlantIds,
      });
    },
  );

  it("does not reorder the supplied catalog when finding rewards", () => {
    advanceGarden(4, catalog);
    expect(catalog.map((plant) => plant.id)).toEqual([
      "cherry",
      "clover",
      "sunflower",
      "daisy",
    ]);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "rejects an invalid or overflowing total %s",
    (total) => {
      expect(() => advanceGarden(total, catalog)).toThrow(RangeError);
    },
  );
});

describe("projectPlant", () => {
  const daisy: CatalogPlant = Object.freeze({
    id: "daisy",
    slotIndex: 1,
    unlockAt: 5,
  });

  it.each([
    [5, 0, "sprout", 0],
    [7, 2, "sprout", 0],
    [8, 3, "seedling", 1],
    [11, 6, "seedling", 1],
    [12, 7, "growing", 2],
    [18, 13, "growing", 2],
    [19, 14, "mature", 3],
    [1005, 1000, "mature", 3],
  ])(
    "projects lifetime total %i as %i points, %s stage, index %i",
    (total, growthPoints, stage, stageIndex) => {
      expect(projectPlant(total, daisy)).toEqual({
        growthPoints,
        stage,
        stageIndex,
      });
    },
  );

  it.each([
    [{ id: "clover", slotIndex: 0, unlockAt: 0 }, 0],
    [{ id: "daisy", slotIndex: 1, unlockAt: 5 }, 5],
    [{ id: "sunflower", slotIndex: 2, unlockAt: 15 }, 15],
    [{ id: "cherry", slotIndex: 3, unlockAt: 30 }, 30],
  ] as const)(
    "starts $0.id at zero points on its unlock total",
    (plant, total) => {
      expect(projectPlant(total, plant)).toEqual({
        growthPoints: 0,
        stage: "sprout",
        stageIndex: 0,
      });
    },
  );

  it.each([-1, 4, 4.5, NaN, Infinity])(
    "rejects ineligible or invalid total %s rather than inventing locked growth",
    (total) => {
      expect(() => projectPlant(total, daisy)).toThrow(RangeError);
    },
  );
});
