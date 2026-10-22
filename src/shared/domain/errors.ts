export type ErrorCode =
  | "UNAUTHENTICATED"
  | "ONBOARDING_REQUIRED"
  | "VALIDATION_ERROR"
  | "TIME_ZONE_FIXED"
  | "SERVICE_UNAVAILABLE";

export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

export type ActionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: ErrorCode;
        message: string;
        fieldErrors?: Readonly<{ timeZone?: readonly string[] }>;
        correlationId?: string;
      }>;
    }>;
