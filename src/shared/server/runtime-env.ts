import "server-only";
import { parseRuntimeEnv, type RuntimeEnv } from "./runtime-env-schema";

// Call only from a runtime service that needs credentials; importing this module is inert.
export function getRuntimeEnv(): RuntimeEnv {
  return parseRuntimeEnv(process.env);
}
