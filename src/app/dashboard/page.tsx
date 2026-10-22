import { redirect } from "next/navigation";
import { entryState } from "../../features/auth/runtime.ts";
import { Unavailable } from "../../shared/ui/unavailable.tsx";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await entryState();
  if (state.kind === "signed_out") redirect("/");
  if (state.kind === "onboarding") redirect("/onboarding");
  if (state.kind === "unavailable")
    return (
      <main className="shell">
        <Unavailable correlationId={state.error.correlationId} />
      </main>
    );
  const dashboard = state.dashboard;
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
      <section aria-labelledby="habits-heading">
        <h2 id="habits-heading">Daily habits</h2>
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
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="garden-heading">
        <h2 id="garden-heading">Your garden</h2>
        <p>{dashboard.lifetimeCompletionCount} lifetime completions</p>
        <ul className="garden">
          {dashboard.plants.map((plant) => (
            <li key={plant.plantId}>
              <h3>{plant.name}</h3>
              <p>
                {plant.unlocked
                  ? `${plant.stage} · ${plant.growthPoints} growth points`
                  : `Unlocks at ${plant.unlockAt} completions`}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
