import { redirect } from "next/navigation";
import { entryState } from "../../features/auth/runtime.ts";
import { Unavailable } from "../../shared/ui/unavailable.tsx";
import { DashboardView } from "../../features/habits/dashboard-view.tsx";

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
  return <DashboardView initialDashboard={state.dashboard} />;
}
