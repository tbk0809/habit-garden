import { expect, test } from "vitest";
import {
  archiveHabitCommand,
  createHabitCommand,
} from "../../src/features/habits/input.ts";

test.each([
  [" Read ", "Read"],
  ["\tWalk\n", "Walk"],
  ["a", "a"],
  ["a".repeat(80), "a".repeat(80)],
  ["🌱".repeat(80), "🌱".repeat(80)],
])(
  "normalizes a valid title without counting UTF-16 units %j",
  (title, want) => {
    expect(createHabitCommand.parse({ title })).toEqual({ title: want });
  },
);

test.each([
  null,
  {},
  { title: 42 },
  { title: "" },
  { title: " \n\t " },
  { title: "a".repeat(81) },
  { title: "🌱".repeat(81) },
  { title: "Read\0books" },
  { title: "\u0085Read" },
  { title: "Read\u0085" },
  { title: "Read", userId: "forged" },
  { title: "Read", archivedAt: "2026-10-23" },
])("rejects malformed title or authority without SQL %j", (input) => {
  expect(createHabitCommand.safeParse(input).success).toBe(false);
});

test("archive accepts only a UUID without extra authority", () => {
  const habitId = "90000000-0000-4000-8000-000000000001";
  expect(archiveHabitCommand.parse({ habitId })).toEqual({ habitId });
  for (const input of [
    null,
    {},
    { habitId: "not-a-uuid" },
    { habitId, userId: habitId },
    { habitId, archivedAt: "2026-10-23" },
  ]) {
    expect(archiveHabitCommand.safeParse(input).success).toBe(false);
  }
});
