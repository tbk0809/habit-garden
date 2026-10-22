# Habit Garden — approved implementation handoff

Date: 2026-10-22, Asia/Kuala_Lumpur. Scope, dependencies, and coding authorized by the user. This handoff specifies the existing approved design; it is not implemented code or passing acceptance evidence. Execute [ordered tasks](docs/05-task-breakdown.md) in order. [PRD](PRD.md) owns P0/AC01–AC12, [data design](docs/01-data-design.md) owns DB/domain invariants, [PROJECT_FRAME](PROJECT_FRAME.md) owns boundaries, and [FLOWS](FLOWS.md) owns interactions.

## Delivery boundary

Implement GitHub/database-session sign-in, immutable confirmed timezone, up to ten active daily habits, creation/listing/archiving, one completion per habit/local date, current/best streaks, lifetime total, and four fixed authored SVG garden slots. Use the approved Next.js/TypeScript/PostgreSQL/Drizzle/Auth.js/Zod/Vitest/Playwright/CSS stack. Pin exact compatible versions before install; add no feature, dependency, service, or auth/storage replacement through this handoff.

No schedules, editing/reactivation, undo/backfill, deletion, reminders, placements, themes, analytics, AI, payments, or production demo login. Public-source approval excludes personal data and secrets. Local real sign-in still requires the user's GitHub OAuth configuration. No functional code, package installation, migration, or passing test is claimed by these specifications.

## Values and server projection

The following are wire/type contracts for implementation, not executable application code. All returned structures are JSON-serializable readonly values. IDs are UUID strings; `CivilDate` is a validated real Gregorian date in canonical `YYYY-MM-DD`; `Instant` is an ISO 8601 UTC instant. No SQL `date` passes through JavaScript timestamp serialization. `PlantId` is `clover | daisy | sunflower | cherry`; `Stage` is `sprout | seedling | growing | mature`.

| DTO | Exact fields |
|---|---|
| `HabitDTO` | `id: UUID`, `title: string`, `completedToday: boolean`, `currentStreak: number`, `bestStreak: number`. Only active owned habits appear in the dashboard. |
| `LockedPlantDTO` | `plantId: PlantId`, `name: string`, `slotIndex: 0\|1\|2\|3`, `unlockAt: number`, `unlocked: false`. No growth/stage is invented for a locked slot. |
| `OwnedPlantDTO` | The same identity/name/slot/threshold fields, `unlocked: true`, `growthPoints: number`, `stage: Stage`, `stageIndex: 0\|1\|2\|3`. |
| `DashboardDTO` | `asOf: Instant`, `localDate: CivilDate`, `timeZone: string`, `habits: HabitDTO[]`, `lifetimeCompletionCount: number`, `plants: (LockedPlantDTO \| OwnedPlantDTO)[]` in slot order. |
| `OnboardingDTO` | `suggestedTimeZone: string \| null`; browser suggestion is untrusted and requires explicit user confirmation. Confirmed timezone lives in `DashboardDTO`. |

Habit ordering is ascending creation timestamp then ID. The four garden slots are always present in slot order. `asOf`, `localDate`, today's logs, current streaks, total, and plants come from one coherent server snapshot. Read-time date uses one DB instant plus the stored zone; successful mutation projections use the transaction's authoritative instant/date. Do not return user email, provider tokens, session tokens, raw DB rows, credentials, or another owner's identifiers. Private DTOs are request-scoped and never shared in a public cache.

## Actions and safe results

Boundary functions accept untrusted serialized input, parse it with Zod, derive the user from an unexpired database session, and call a service. No command accepts a user ID, growth/streak count, client timestamp, plant reward, or archive timestamp. Reject malformed/extra command fields rather than allowing them to become authority.

All application mutations return a discriminated safe result: success is `{ ok: true, data: SuccessDTO }`; failure is `{ ok: false, error: { code, message, fieldErrors?, correlationId? } }`. `fieldErrors` maps the known command field to safe messages for validation; `correlationId` is used for unexpected/unavailable failures. No raw SQL/provider error or input/credential value enters the result. Framework redirects and Auth.js managed sign-in/sign-out remain framework/library operations.

| Action | Input | Success data |
|---|---|---|
| `confirmTimeZoneAction` | `{ timeZone: string }` | `{ status: 'initialized' \| 'already_initialized', dashboard: DashboardDTO }`. Same-zone repeat is already initialized; different-zone repeat fails. |
| `createHabitAction` | `{ title: string }` | `{ habitId: UUID, dashboard: DashboardDTO }`. Title is trimmed and validated 1–80 characters consistently with the DB constraint. |
| `archiveHabitAction` | `{ habitId: UUID }` | `{ habitId: UUID, status: 'archived' \| 'already_archived', dashboard: DashboardDTO }`. Both statuses preserve rewards. |
| `completeHabitAction` | `{ habitId: UUID, expectedLocalDate: CivilDate }` | `{ habitId: UUID, status: 'completed' \| 'already_completed', dashboard: DashboardDTO }`. Duplicate is successful without another reward. |

`expectedLocalDate` is the last dashboard's server-issued `localDate` and only a precondition. Validate it as an actual calendar date. It never authorizes backfill or next-day completion. The server checks it after acquiring the user lock and obtaining a new DB clock instant. A successful duplicate-after-archive response still omits the archived habit from the returned active list.

| Failure code | Meaning and UI response |
|---|---|
| `UNAUTHENTICATED` | Missing/expired session; return to sign-in without data mutation. |
| `ONBOARDING_REQUIRED` | Session exists but user not initialized; navigate to timezone confirmation. |
| `VALIDATION_ERROR` | Invalid title/UUID/date/zone/shape; preserve input and associate field messages. |
| `NOT_FOUND` | Missing or foreign-owned habit; same response for both, refresh list. |
| `LIMIT_REACHED` | Ten active habits already exist; preserve title and explain archive frees capacity. |
| `HABIT_ARCHIVED` | New completion for archived habit; refresh active list. |
| `DAY_ROLLED_OVER` | Stale expected date; refresh authoritative state and require a fresh explicit submit. HTTP 409 if a route adapter is ever applicable; Server Actions carry the result code. |
| `TIME_ZONE_FIXED` | Different timezone after confirmation; reload existing state. |
| `SERVICE_UNAVAILABLE` | Unexpected DB/config/invariant/connection failure; generic retry message and correlation ID, with redacted server log. Never silently repair/reset reward state. |

Revalidate authenticated affected paths after success and render authoritative DTOs. Return success only after commit succeeds. An uncertain network outcome shows retry; retry idempotence is a service guarantee. Do not automatically replay a stale completion on a refreshed new date.

## Pure domain contracts

Pure functions must neither mutate inputs nor import React, Next.js, DB, sessions, environment, network, or clocks. Runtime boundary/service validation supplies canonical dates and valid nonnegative state. Calendar arithmetic uses dates rather than elapsed 24-hour milliseconds. Internal date-order/invariant failures map to the safe unavailable result at the boundary.

| Contract | Input/output and required behavior |
|---|---|
| `guardExpectedDate(expected: CivilDate, authoritative: CivilDate)` | Returns `{ ok: true }` on equality; otherwise `{ ok: false, code: 'DAY_ROLLED_OVER' }`. |
| `advanceStreak(previous: StreakState, acceptedDate: CivilDate)` | `StreakState = { runLength: number, bestStreak: number, lastCompletedOn: CivilDate \| null }`. Returns `{ ok: true, streak: StreakState }`; first completion → 1/1; next civil date → run+1 and max best; a larger gap → run 1 and preserved max best. Equal date returns `{ ok: false, code: 'DUPLICATE_DATE' }`; earlier date returns `{ ok: false, code: 'DATE_ORDER_INVALID' }`. No input mutation. |
| `projectCurrentStreak(streak: StreakState, asOfDate: CivilDate)` | Returns a number: stored run if last completion is today/yesterday, otherwise 0 for older/absent completion. A future stored completion is an invariant failure, not zero or a mutation. Best/history are unaffected. |
| `advanceGarden(previousTotal: number, catalog: readonly CatalogPlant[])` | Returns `{ nextTotal: number, newlyEligiblePlantIds: PlantId[] }`; nextTotal = previousTotal+1; newly eligible means previousTotal < unlockAt ≤ nextTotal, ordered by slot. Threshold-zero starter is initialized separately at onboarding. Call only after one confirmed new log insert. |
| `projectPlant(total: number, catalogPlant: CatalogPlant)` | For an eligible owned plant, returns `{ growthPoints: number, stage: Stage, stageIndex: 0\|1\|2\|3 }`, with points = total−unlockAt, stages 0–2 sprout/0, 3–6 seedling/1, 7–13 growing/2, 14+ mature/3. Calling it for an ineligible/negative state is an invariant failure; locked-slot projection does not call it. |

`CatalogPlant = { id: PlantId, slotIndex: 0|1|2|3, unlockAt: number }`; exact migration-installed combinations are clover/0/0, daisy/1/5, sunflower/2/15, cherry/3/30. The empty streak is 0/0/null; nonnull dates require run≥1 and best≥run. Domain tests cover the public behavior of these contracts, including duplicate/order errors. Services avoid calling `advanceStreak`/`advanceGarden` for duplicate completions.

## Transactions, persistence, and auth

All domain writers acquire the user row lock first. Create checks the active cap and inserts the habit/zero streak together. Archive locks the owned habit next and sets its timestamp once. Onboarding validates zone in application and DB, then atomically initializes timezone, garden, and starter. An initialized zone cannot change.

Completion is one READ COMMITTED transaction: resolve/validate session/input → lock user and check initialized state → fetch habit with owner → capture `clock_timestamp()` in a separate post-lock statement → compare expected date → check existing log → reject archive if no log → insert with `RETURNING` → pure streak/growth transitions → persist streak/total/eligible rewards → coherent DTO → commit. Any failure rolls back all effects. Never use transaction-start `now()` for authoritative completion or network calls inside a transaction. A foreign ID returns safe not-found. Ownership predicates are mandatory on every private read/write, including joins.

Implement the nine tables, adapter mappings/defaults, composite ownership FKs, constraints, partial indexes, immutable guards, runtime permissions, and journal from [data design](docs/01-data-design.md). Catalog rows are a migration; stage/growth are derived. Runtime and migration roles are separate. No production seed, reset, fixture session, destructive migration, or automatic down migration.

Auth.js database-session callback explicitly puts adapter `user.id` into `session.user.id`; add matching TS augmentation and integration coverage. Keep Auth.js origin/CSRF/cookie/sign-out controls and Server Action origin checks. Do not enable dangerous email linking or repository scopes. E2E session fixtures write ordinary adapter sessions only in a verified disposable loopback test DB, in test-runner code; never expose an application login bypass.

## UI and operational handoff

Implement the routes, pending/empty/error/day-change/archive focus behavior, and text/SVG equivalence from [FLOWS](FLOWS.md). Garden is fixed informational SVG/CSS with reduced motion. Use semantic labeled forms/buttons, visible focus, polite announcements, sufficient contrast, and 320 px/desktop layouts. No optimistic growth or client-derived completion date.

`/api/status` is read-only public liveness with safe status and the baked source SHA; `/api/ready` additionally performs a bounded minimal DB read and returns success or 503 with no DB details. Both are runtime handlers; readiness never migrates/seeds or exposes private data. Release uses exact-source staged/canonical checks from [CI/CD design](docs/03-cicd-plan.md).

Keep runtime environment validation/connection creation lazy and server-only. `npm run build` must succeed without a reachable DB, OAuth credentials, or Auth.js secret. Never fetch protected data at import/build time; protected pages are request-time. `.env.example` uses placeholders only. Source publication never includes `.env` files, tokens/cookies, DB dumps, or browser auth state.

## Verification and reporting

[GATES](GATES.md) maps commands to AC01–AC12 and distinguishes manual provider checks from fixtures. Run applicable format/lint/type/unit/integration checks after each meaningful application step; record unavailable checks honestly until implemented. Implement the full `bash check.sh` gate only when its real component suites exist, then require it before a working-app/release claim. Append each step immediately to `GIT_FILE.md`, preserve historical entries, and commit only with actual checked results and Conventional Commits. No application verification has run for this document substep.
