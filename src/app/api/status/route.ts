import { buildInfo } from "../../../shared/server/build-info.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { status: "ok", ...buildInfo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
