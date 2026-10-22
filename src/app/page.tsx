import { redirect } from "next/navigation";
import { entryState } from "../features/auth/runtime.ts";
import { signInAction } from "../features/auth/actions.ts";
import { Unavailable } from "../shared/ui/unavailable.tsx";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const state = await entryState();
  const params = await searchParams;
  if (!params.error) {
    if (state.kind === "ready") redirect("/dashboard");
    if (state.kind === "onboarding") redirect("/onboarding");
  }
  return (
    <main className="shell entry">
      <p className="eyebrow">Daily habits, steady growth</p>
      <h1>Habit Garden</h1>
      <p>
        Make room for small daily habits. Each completion helps your garden
        grow.
      </p>
      {state.kind === "unavailable" ? (
        <Unavailable correlationId={state.error.correlationId} />
      ) : (
        <>
          {params.error && (
            <p role="alert">Sign-in couldn't finish. Please try again.</p>
          )}
          <form action={signInAction}>
            <button type="submit">Continue with GitHub</button>
          </form>
          {(state.kind === "ready" || state.kind === "onboarding") && (
            <a href={state.kind === "ready" ? "/dashboard" : "/onboarding"}>
              Return to your garden
            </a>
          )}
        </>
      )}
    </main>
  );
}
