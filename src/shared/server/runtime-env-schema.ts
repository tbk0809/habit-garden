import { z } from "zod";

const configuredString = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value && !value.startsWith("replace_"));
const runtimeEnvSchema = z.object({
  DATABASE_URL: configuredString.refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["postgres:", "postgresql:"].includes(url.protocol) &&
        url.hostname.length > 0 &&
        url.username.length > 0 &&
        url.password.length > 0 &&
        url.pathname.length > 1
      );
    } catch {
      return false;
    }
  }),
  AUTH_SECRET: configuredString.min(32),
  AUTH_GITHUB_ID: configuredString,
  AUTH_GITHUB_SECRET: configuredString,
  AUTH_URL: configuredString.refine((value) => {
    try {
      const url = new URL(value);
      return (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/" &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      );
    } catch {
      return false;
    }
  }),
});

export type RuntimeEnv = Readonly<z.infer<typeof runtimeEnvSchema>>;

export function parseRuntimeEnv(raw: unknown): RuntimeEnv {
  const result = runtimeEnvSchema.safeParse(raw);
  if (!result.success) throw new Error("Runtime configuration is unavailable.");
  return result.data;
}
