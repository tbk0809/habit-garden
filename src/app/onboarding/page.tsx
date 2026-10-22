import { redirect } from "next/navigation";
import { entryState } from "../../features/auth/runtime.ts";
import { TimeZoneForm } from "../../features/auth/timezone-form.tsx";
import { Unavailable } from "../../shared/ui/unavailable.tsx";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const state = await entryState();
  if (state.kind === "signed_out") redirect("/");
  if (state.kind === "ready") redirect("/dashboard");
  return (
    <main className="shell entry">
      {state.kind === "unavailable" ? (
        <Unavailable correlationId={state.error.correlationId} />
      ) : (
        <>
          <p className="eyebrow">A place to begin</p>
          <h1>When does your day begin?</h1>
          <p>Confirm the timezone your daily habits will follow.</p>
          <TimeZoneForm />
          {/* Auth.js serves its own HTML confirmation page. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/auth/signout?callbackUrl=/">Sign out</a>
        </>
      )}
    </main>
  );
}
