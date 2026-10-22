import type { NextRequest } from "next/server";
import { authOperation } from "../../../../features/auth/runtime.ts";
import { getRuntimeEnv } from "../../../../shared/server/runtime-env.ts";
import { safeFailure } from "../../../../shared/server/result.ts";
import { allowsAuthRequest } from "../../../../features/auth/origin.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: NextRequest) {
  try {
    if (!allowsAuthRequest(request, getRuntimeEnv().AUTH_URL))
      return new Response("Request refused.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    const operation = authOperation();
    const response =
      await operation.handlers[request.method === "POST" ? "POST" : "GET"](
        request,
      );
    // Auth.js can catch an adapter error. Withhold its response/cookie clearing
    // on failure so sign-out is successful only after real revocation.
    operation.assertAvailable();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const failure = safeFailure(error);
    return new Response(
      `<!doctype html><html lang="en"><title>Please try again</title><main><h1>We couldn't finish that</h1><p>Please try again in a moment.</p><p>Reference: ${failure.error.correlationId ?? "unavailable"}</p><a href="/">Return to Habit Garden</a></main></html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export const GET = handle;
export const POST = handle;
