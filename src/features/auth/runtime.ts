import "server-only";
import NextAuth from "next-auth";
import { getDatabase } from "../../shared/server/db/client.ts";
import { getRuntimeEnv } from "../../shared/server/runtime-env.ts";
import { createAuthConfig } from "./config.ts";
import { ApplicationError } from "../../shared/domain/errors.ts";
import { safeFailure } from "../../shared/server/result.ts";
import { dashboardForSession } from "../dashboard/read.ts";

export function authOperation() {
  let failed = false;
  // NextAuth calls this factory at request/action time, never during module import.
  const auth = NextAuth(() =>
    createAuthConfig(getDatabase(), getRuntimeEnv(), () => {
      failed = true;
    }),
  );
  return {
    ...auth,
    assertAvailable() {
      if (failed) throw new ApplicationError("SERVICE_UNAVAILABLE");
    },
  };
}

export async function readSession() {
  const operation = authOperation();
  const session = await operation.auth();
  operation.assertAvailable();
  return session;
}

export async function entryState() {
  try {
    const session = await readSession();
    if (!session) return { kind: "signed_out" as const };
    const result = await dashboardForSession(getDatabase(), session);
    if (result.ok) return { kind: "ready" as const, dashboard: result.data };
    if (result.error.code === "UNAUTHENTICATED")
      return { kind: "signed_out" as const };
    if (result.error.code === "ONBOARDING_REQUIRED")
      return { kind: "onboarding" as const };
    return { kind: "unavailable" as const, error: result.error };
  } catch (error) {
    return { kind: "unavailable" as const, error: safeFailure(error).error };
  }
}
