"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTimeZoneAction } from "./actions.ts";
import type { ActionResult } from "../../shared/domain/errors.ts";
import type { OnboardingSuccess } from "./onboarding.ts";

export function TimeZoneForm() {
  const [timeZone, setTimeZone] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult<OnboardingSuccess> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    try {
      setSuggestion(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      /* Suggestion is optional; confirmation is always explicit. */
    }
  }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const response = await confirmTimeZoneAction({ timeZone });
        setResult(response);
        if (response.ok) {
          router.replace("/dashboard");
          router.refresh();
        } else if (response.error.code === "UNAUTHENTICATED") {
          router.replace("/");
          router.refresh();
        } else if (response.error.code === "TIME_ZONE_FIXED") {
          router.replace("/dashboard");
          router.refresh();
        } else if (response.error.code === "VALIDATION_ERROR")
          input.current?.focus();
      } catch {
        setResult({
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "We couldn't confirm your timezone. Please try again.",
          },
        });
      }
    });
  }
  const error = result && !result.ok ? result.error : null;
  return (
    <form onSubmit={submit} aria-busy={pending}>
      <label htmlFor="time-zone">Your IANA timezone</label>
      <input
        ref={input}
        id="time-zone"
        name="timeZone"
        value={timeZone}
        onChange={(event) => setTimeZone(event.target.value)}
        placeholder="Asia/Kuala_Lumpur"
        required
        maxLength={100}
        aria-invalid={error?.code === "VALIDATION_ERROR"}
        aria-describedby={`timezone-help${error ? " timezone-error" : ""}`}
        disabled={pending}
      />
      <p id="timezone-help">
        Daily habits follow this timezone. Once confirmed, it cannot be changed.
      </p>
      {suggestion && (
        <p>
          Your browser suggests {suggestion}.{" "}
          <button
            className="secondary"
            type="button"
            onClick={() => setTimeZone(suggestion)}
            disabled={pending}
          >
            Use suggested timezone
          </button>
        </p>
      )}
      {error && (
        <p id="timezone-error" role="alert">
          {error.message}
          {error.correlationId && (
            <span className="muted"> Reference: {error.correlationId}</span>
          )}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Confirming…" : "Confirm timezone and start"}
      </button>
      <p role="status" aria-live="polite">
        {pending
          ? "Confirming your timezone…"
          : result?.ok
            ? "Your garden is ready."
            : ""}
      </p>
    </form>
  );
}
