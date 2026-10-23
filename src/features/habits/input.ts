import { z } from "zod";
import { civilDate } from "../../shared/domain/civil-date.ts";

export const createHabitCommand = z.strictObject({
  title: z
    .string()
    .trim()
    .refine((title) => {
      const length = Array.from(title).length;
      return (
        length >= 1 &&
        length <= 80 &&
        !title.includes("\0") &&
        !/^\p{White_Space}|\p{White_Space}$/u.test(title)
      );
    }, "Use a title of 1–80 characters."),
});
export const archiveHabitCommand = z.strictObject({ habitId: z.uuid() });
export const completeHabitCommand = z.strictObject({
  habitId: z.uuid(),
  expectedLocalDate: z.string().transform((value, ctx) => {
    try {
      return civilDate(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Use a real calendar date." });
      return z.NEVER;
    }
  }),
});
