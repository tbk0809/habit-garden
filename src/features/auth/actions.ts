"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRuntimeEnv } from "../../shared/server/runtime-env.ts";
import { getDatabase } from "../../shared/server/db/client.ts";
import { safeFailure } from "../../shared/server/result.ts";
import { authOperation, readSession } from "./runtime.ts";
import { confirmTimeZoneForSession } from "./onboarding.ts";

export async function signInAction() {
  let destination = "/?error=unavailable";
  try {
    const env = getRuntimeEnv();
    if ((await headers()).get("origin") !== new URL(env.AUTH_URL).origin)
      throw new Error("Origin refused.");
    const operation = authOperation();
    destination = await operation.signIn("github", {
      redirect: false,
      redirectTo: "/dashboard",
    });
    operation.assertAvailable();
  } catch (error) {
    safeFailure(error);
    destination = "/?error=unavailable";
  }
  redirect(destination);
}

export async function confirmTimeZoneAction(input: unknown) {
  try {
    const session = await readSession();
    const result = await confirmTimeZoneForSession(
      getDatabase(),
      session,
      input,
    );
    if (result.ok) {
      revalidatePath("/onboarding");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (error) {
    return safeFailure(error);
  }
}
