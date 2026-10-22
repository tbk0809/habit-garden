import { z } from "zod";

export const timeZoneCommand = z.strictObject({
  timeZone: z.string().refine((value) => {
    if (!value || value.trim() !== value || /^[+-]/.test(value)) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
      return true;
    } catch {
      return false;
    }
  }, "Choose a supported IANA timezone."),
});
