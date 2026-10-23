import { checkDatabaseReadiness } from "../../../shared/server/health.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await checkDatabaseReadiness(process.env.DATABASE_URL);
  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
