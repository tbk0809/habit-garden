export type ErrorCode =
  | "UNAUTHENTICATED"
  | "ONBOARDING_REQUIRED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "LIMIT_REACHED"
  | "DAY_ROLLED_OVER"
  | "HABIT_ARCHIVED"
  | "TIME_ZONE_FIXED"
  | "SERVICE_UNAVAILABLE";

export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  public readonly fieldErrors?: FieldErrors;
  constructor(code: ErrorCode, fieldErrors?: FieldErrors) {
    super(code);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type FieldErrors = Readonly<{
  timeZone?: readonly string[];
  title?: readonly string[];
  habitId?: readonly string[];
}>;

export type ActionResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: ErrorCode;
        message: string;
        fieldErrors?: FieldErrors;
        correlationId?: string;
      }>;
    }>;
