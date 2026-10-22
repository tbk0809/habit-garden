export type PlantId = "clover" | "daisy" | "sunflower" | "cherry";
export type Stage = "sprout" | "seedling" | "growing" | "mature";
export type SlotIndex = 0 | 1 | 2 | 3;
export type CatalogPlant = Readonly<{
  id: PlantId;
  slotIndex: SlotIndex;
  unlockAt: number;
}>;

export function advanceGarden(
  previousTotal: number,
  catalog: readonly CatalogPlant[],
): Readonly<{ nextTotal: number; newlyEligiblePlantIds: readonly PlantId[] }> {
  assertTotal(previousTotal);
  const nextTotal = previousTotal + 1;
  assertTotal(nextTotal);
  const newlyEligiblePlantIds = catalog
    .filter(
      (plant) => previousTotal < plant.unlockAt && plant.unlockAt <= nextTotal,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((plant) => plant.id);
  return { nextTotal, newlyEligiblePlantIds };
}

export function projectPlant(
  total: number,
  catalogPlant: CatalogPlant,
): Readonly<{ growthPoints: number; stage: Stage; stageIndex: SlotIndex }> {
  assertTotal(total);
  if (total < catalogPlant.unlockAt)
    throw new RangeError("Plant is not eligible at this total.");
  const growthPoints = total - catalogPlant.unlockAt;
  const stageIndex =
    growthPoints >= 14 ? 3 : growthPoints >= 7 ? 2 : growthPoints >= 3 ? 1 : 0;
  const stages = ["sprout", "seedling", "growing", "mature"] as const;
  return { growthPoints, stage: stages[stageIndex], stageIndex };
}

function assertTotal(total: number): void {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new RangeError(
      "Completion total must be a nonnegative safe integer.",
    );
}
