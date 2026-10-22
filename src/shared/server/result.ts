import "server-only";
import { randomUUID } from "node:crypto";
import {
  ApplicationError,
  type ActionResult,
  type ErrorCode,
} from "../domain/errors.ts";

const messages: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  ONBOARDING_REQUIRED: "Confirm your timezone to start your garden.",
  VALIDATION_ERROR: "Choose a supported IANA timezone.",
  TIME_ZONE_FIXED:
    "Your timezone is already confirmed. Open your dashboard to continue.",
  SERVICE_UNAVAILABLE: "We couldn't load your garden. Please try again.",
};

export function safeFailure(
  error: unknown,
): Extract<ActionResult<never>, { ok: false }> {
  const code =
    error instanceof ApplicationError ? error.code : "SERVICE_UNAVAILABLE";
  if (code === "SERVICE_UNAVAILABLE") {
    const correlationId = randomUUID();
    // Never log the thrown object: drivers/providers can attach SQL, tokens or URLs.
    console.error(
      JSON.stringify({ event: "service_unavailable", correlationId }),
    );
    return {
      ok: false,
      error: { code, message: messages[code], correlationId },
    };
  }
  return {
    ok: false,
    error: {
      code,
      message: messages[code],
      ...(code === "VALIDATION_ERROR"
        ? { fieldErrors: { timeZone: [messages[code]] } }
        : {}),
    },
  };
}
