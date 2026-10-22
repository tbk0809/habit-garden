import type { CivilDate } from "./civil-date";
import type {
  PlantId,
  SlotIndex,
  Stage,
} from "../../features/garden/domain/growth";

export type UUID = string;
export type Instant = string;

export type HabitDTO = Readonly<{
  id: UUID;
  title: string;
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
}>;

type PlantIdentity = Readonly<{
  plantId: PlantId;
  name: string;
  slotIndex: SlotIndex;
  unlockAt: number;
}>;
export type LockedPlantDTO = PlantIdentity & Readonly<{ unlocked: false }>;
export type OwnedPlantDTO = PlantIdentity &
  Readonly<{
    unlocked: true;
    growthPoints: number;
    stage: Stage;
    stageIndex: SlotIndex;
  }>;

export type DashboardDTO = Readonly<{
  asOf: Instant;
  localDate: CivilDate;
  timeZone: string;
  habits: readonly HabitDTO[];
  lifetimeCompletionCount: number;
  plants: readonly (LockedPlantDTO | OwnedPlantDTO)[];
}>;

export type OnboardingDTO = Readonly<{ suggestedTimeZone: string | null }>;
