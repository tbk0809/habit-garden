"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "../auth/runtime.ts";
import { getDatabase } from "../../shared/server/db/client.ts";
import { safeFailure } from "../../shared/server/result.ts";
import { archiveHabitForSession, createHabitForSession } from "./service.ts";

export async function createHabitAction(input: unknown) {
  try {
    const session = await readSession();
    const result = await createHabitForSession(getDatabase(), session, input);
    if (result.ok) revalidatePath("/dashboard");
    return result;
  } catch (error) {
    return safeFailure(error);
  }
}

export async function archiveHabitAction(input: unknown) {
  try {
    const session = await readSession();
    const result = await archiveHabitForSession(getDatabase(), session, input);
    if (result.ok) revalidatePath("/dashboard");
    return result;
  } catch (error) {
    return safeFailure(error);
  }
}
