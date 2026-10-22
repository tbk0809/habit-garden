import { z } from "zod";
import { ApplicationError } from "../../shared/domain/errors.ts";

declare const scopeBrand: unique symbol;
export type AuthenticatedScope = Readonly<{
  userId: string;
  [scopeBrand]: true;
}>;
const sessionSchema = z.object({
  user: z.object({ id: z.uuid() }),
  expires: z.iso.datetime({ offset: true }),
});

export function sessionScope(
  session: unknown,
  now = new Date(),
): AuthenticatedScope {
  const parsed = sessionSchema.safeParse(session);
  if (!parsed.success || Date.parse(parsed.data.expires) <= now.getTime())
    throw new ApplicationError("UNAUTHENTICATED");
  return { userId: parsed.data.user.id } as AuthenticatedScope;
}
