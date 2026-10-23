"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardDTO } from "../../shared/domain/dashboard.ts";
import type { ActionResult } from "../../shared/domain/errors.ts";
import {
  archiveHabitAction,
  createHabitAction,
  completeHabitAction,
} from "./actions.ts";
import { Garden } from "../garden/garden.tsx";
import type { CivilDate } from "../../shared/domain/civil-date.ts";

type Failure = Extract<ActionResult<unknown>, { ok: false }>["error"];
type Operation =
  { kind: "create" } | { kind: "archive" | "complete"; habitId: string };
type Completion = { habitId: string; expectedLocalDate: CivilDate };

export function DashboardView({
  initialDashboard,
}: {
  initialDashboard: DashboardDTO;
}) {
  const [latest, setLatest] = useState(initialDashboard);
  // A refreshed server projection can supersede the last successful mutation.
  const dashboard =
    initialDashboard.asOf > latest.asOf ? initialDashboard : latest;
  const [title, setTitle] = useState("");
  const [error, setError] = useState<Failure | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [operation, setOperation] = useState<Operation | null>(null);
  const [retryCompletion, setRetryCompletion] = useState<Completion | null>(
    null,
  );
  const [rolledOverDate, setRolledOverDate] = useState<CivilDate | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const archiveButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterPending = useRef<string | "title" | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (pending || focusAfterPending.current === null) return;
    const target = focusAfterPending.current;
    focusAfterPending.current = null;
    (target === "title"
      ? input.current
      : (archiveButtons.current.get(target) ?? input.current)
    )?.focus();
  }, [pending, dashboard]);

  function failure(failed: Failure) {
    setError(failed);
    setAnnouncement("");
    if (failed.code === "UNAUTHENTICATED") {
      router.replace("/");
      router.refresh();
    } else if (failed.code === "ONBOARDING_REQUIRED") {
      router.replace("/onboarding");
      router.refresh();
    } else if (failed.code === "DAY_ROLLED_OVER") {
      setRolledOverDate(dashboard.localDate);
      setRetryCompletion(null);
      router.refresh();
    } else if (
      failed.code === "NOT_FOUND" ||
      failed.code === "HABIT_ARCHIVED"
    ) {
      focusAfterPending.current = "title";
      router.refresh();
    } else if (failed.fieldErrors?.title) {
      focusAfterPending.current = "title";
    }
  }
  function unavailable() {
    failure({
      code: "SERVICE_UNAVAILABLE",
      message: "We couldn't save that change. Please try again.",
    });
  }
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setOperation({ kind: "create" });
    setError(null);
    setRetryCompletion(null);
    startTransition(async () => {
      try {
        const result = await createHabitAction({ title });
        if (!result.ok) {
          failure(result.error);
          return;
        }
        setLatest(result.data.dashboard);
        setTitle("");
        const created = result.data.dashboard.habits.find(
          (habit) => habit.id === result.data.habitId,
        );
        setAnnouncement(
          created ? `Created ${created.title}.` : "Created habit.",
        );
        focusAfterPending.current = "title";
      } catch {
        unavailable();
      }
    });
  }
  function archive(habitId: string) {
    if (pending) return;
    const index = dashboard.habits.findIndex((habit) => habit.id === habitId);
    const habit = dashboard.habits[index];
    if (!habit) return;
    setOperation({ kind: "archive", habitId });
    setError(null);
    setRetryCompletion(null);
    startTransition(async () => {
      try {
        const result = await archiveHabitAction({ habitId });
        if (!result.ok) {
          failure(result.error);
          return;
        }
        setLatest(result.data.dashboard);
        setAnnouncement(
          `Archived ${habit.title}. History and rewards are kept.`,
        );
        focusAfterPending.current =
          result.data.dashboard.habits[
            Math.min(index, result.data.dashboard.habits.length - 1)
          ]?.id ?? "title";
      } catch {
        unavailable();
      }
    });
  }

  function complete(command: Completion) {
    if (pending || dashboard.localDate === rolledOverDate) return;
    const habit = dashboard.habits.find((item) => item.id === command.habitId);
    if (!habit) return;
    setOperation({ kind: "complete", habitId: command.habitId });
    setError(null);
    setRetryCompletion(null);
    startTransition(async () => {
      try {
        const result = await completeHabitAction(command);
        if (!result.ok) {
          if (result.error.code === "SERVICE_UNAVAILABLE")
            setRetryCompletion(command);
          failure(result.error);
          return;
        }
        setLatest(result.data.dashboard);
        const garden = result.data.dashboard;
        const changes = garden.plants.flatMap((plant) => {
          if (!plant.unlocked) return [];
          const previous = dashboard.plants.find(
            (item) => item.plantId === plant.plantId,
          );
          if (!previous?.unlocked)
            return [`${plant.name} unlocked at ${plant.stage}.`];
          if (previous.stage !== plant.stage)
            return [`${plant.name} is now ${plant.stage}.`];
          return [];
        });
        setAnnouncement(
          [
            result.data.status === "completed"
              ? `Completed ${habit.title}.`
              : `${habit.title} was already completed today. No extra reward was added.`,
            `Garden total: ${garden.lifetimeCompletionCount} lifetime ${garden.lifetimeCompletionCount === 1 ? "completion" : "completions"}.`,
            ...changes,
          ].join(" "),
        );
      } catch {
        setRetryCompletion(command);
        unavailable();
      }
    });
  }

  const titleError = error?.fieldErrors?.title?.[0];
  return (
    <main className="shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Habit Garden</p>
          <h1>Your daily garden</h1>
        </div>
        {/* Auth.js serves its own HTML confirmation page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/signout?callbackUrl=/">Sign out</a>
      </header>
      <p>
        <time dateTime={dashboard.localDate}>{dashboard.localDate}</time> ·{" "}
        {dashboard.timeZone}
      </p>
      <section aria-labelledby="habits-heading" aria-busy={pending}>
        <h2 id="habits-heading">Daily habits</h2>
        <form onSubmit={create}>
          <label htmlFor="habit-title">Daily habit title</label>
          <input
            ref={input}
            id="habit-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            disabled={pending}
            aria-invalid={Boolean(titleError)}
            aria-describedby={`habit-title-help${error ? " habit-error" : ""}`}
          />
          <p id="habit-title-help">
            Choose a daily habit in 1–80 characters. You can keep up to ten
            active habits.
          </p>
          <button type="submit" disabled={pending}>
            {pending && operation?.kind === "create"
              ? "Creating…"
              : "Create habit"}
          </button>
        </form>
        {error && (
          <p id="habit-error" role="alert">
            {titleError ?? error.message}
            {error.correlationId && (
              <span className="muted"> Reference: {error.correlationId}</span>
            )}
          </p>
        )}
        {error && retryCompletion && (
          <button
            type="button"
            disabled={pending}
            onClick={() => complete(retryCompletion)}
          >
            Try completion again
          </button>
        )}
        <p role="status" aria-live="polite">
          {pending
            ? operation?.kind === "create"
              ? "Creating your habit…"
              : operation?.kind === "complete"
                ? "Completing your habit…"
                : "Archiving your habit…"
            : announcement}
        </p>
        <p id="archive-help">
          Archiving keeps your completion history and garden rewards.
        </p>
        {dashboard.habits.length === 0 ? (
          <p>Your first daily habit will take root here.</p>
        ) : (
          <ul className="habits">
            {dashboard.habits.map((habit) => (
              <li key={habit.id}>
                <h3>{habit.title}</h3>
                <p>
                  {habit.completedToday
                    ? "Completed today"
                    : "Not completed today"}
                </p>
                <p>
                  Current streak: {habit.currentStreak} · Best streak:{" "}
                  {habit.bestStreak}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    complete({
                      habitId: habit.id,
                      expectedLocalDate: dashboard.localDate,
                    })
                  }
                  disabled={
                    pending ||
                    habit.completedToday ||
                    dashboard.localDate === rolledOverDate
                  }
                  aria-label={
                    pending &&
                    operation?.kind === "complete" &&
                    operation.habitId === habit.id
                      ? "Completing…"
                      : `${habit.completedToday ? "Completed" : "Complete"} ${habit.title}`
                  }
                >
                  {pending &&
                  operation?.kind === "complete" &&
                  operation.habitId === habit.id
                    ? "Completing…"
                    : habit.completedToday
                      ? "Completed today"
                      : "Complete today"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => archive(habit.id)}
                  ref={(element) => {
                    if (element) archiveButtons.current.set(habit.id, element);
                    else archiveButtons.current.delete(habit.id);
                  }}
                  disabled={pending}
                  aria-label={`Archive ${habit.title}`}
                  aria-describedby="archive-help"
                >
                  {pending &&
                  operation?.kind === "archive" &&
                  operation.habitId === habit.id
                    ? "Archiving…"
                    : "Archive"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Garden
        plants={dashboard.plants}
        lifetimeCompletionCount={dashboard.lifetimeCompletionCount}
      />
    </main>
  );
}
