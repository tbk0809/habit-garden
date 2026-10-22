import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema/index.ts";
import type { RuntimeEnv } from "../../shared/server/runtime-env-schema.ts";
import { randomUUID } from "node:crypto";

export function createAuthConfig(
  db: NodePgDatabase<typeof schema>,
  env: RuntimeEnv,
  onError?: () => void,
): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(db, schema.adapterTables),
    providers: [
      GitHub({
        clientId: env.AUTH_GITHUB_ID,
        clientSecret: env.AUTH_GITHUB_SECRET,
        authorization: { params: { scope: "read:user" } },
        checks: ["state", "pkce"],
      }),
    ],
    secret: env.AUTH_SECRET,
    session: { strategy: "database" },
    basePath: "/api/auth",
    trustHost: true,
    callbacks: {
      session({ session, user }) {
        return {
          user: { id: user.id },
          expires: session.expires.toISOString(),
        };
      },
      redirect({ url }) {
        const origin = new URL(env.AUTH_URL).origin;
        const target = new URL(url, origin);
        return target.origin === origin &&
          ["/", "/dashboard", "/onboarding"].includes(target.pathname)
          ? `${origin}${target.pathname}`
          : origin;
      },
    },
    pages: { signIn: "/", error: "/" },
    logger: {
      error() {
        onError?.();
        console.error(
          JSON.stringify({
            event: "authentication_unavailable",
            correlationId: randomUUID(),
          }),
        );
      },
      warn() {},
      debug() {},
    },
  };
}
