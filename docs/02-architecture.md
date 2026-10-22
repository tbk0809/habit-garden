# Phase 0.3 — Software architecture

Status: proposal awaiting Phase 0 approval. Date: 2026-10-21, Asia/Kuala_Lumpur. No application code or dependency installation has occurred.

## Product boundary and decisions

Habit Garden is a personal, noncommercial habit tracker: a signed-in person creates daily habits, completes each at most once per local date, and sees a small garden advance. The smallest release has GitHub sign-in, one immutable timezone, daily habit creation/listing/archiving, today's completion, streaks, plant unlocks, and a fixed-slot garden. It has no payments, email delivery, social feed, reminders, analytics service, AI service, images from paid services, custom schedules, backfill, undo, account deletion UI, habit reactivation, or production demo account.

User requirements already fix Next.js, TypeScript, PostgreSQL, local Docker Compose, seed data, free services, tests, and CI/CD. Other choices below require approval with this document. They have not been installed or configured.

| Decision | Proposed choice | Reason and boundary |
|---|---|---|
| Application | One Next.js App Router monolith | One deployable unit and one authorization boundary; no separate API server or microservices. |
| Runtime | Node.js 24 LTS, exact supported patch pinned during Phase 1 | Local Node 25 is not the deployment baseline. Confirm the current Next.js/Vercel compatibility matrix before the first install. |
| SQL and migrations | Drizzle ORM + Drizzle Kit + `pg` | Explicit PostgreSQL constraints, reviewable SQL, small typed data layer, and a single-session migration lock. See `01-data-design.md`. |
| Authentication | Auth.js, GitHub OAuth only, Drizzle adapter, database sessions | No password storage or paid email. Auth.js currently documents `next-auth@beta`; this is a material dependency risk, not a claim of a stable v5 release. Freeze a reviewed compatible exact version set in Phase 1. |
| Validation | Zod at request/environment boundaries | Shared typed input contracts without trusting browser values. Domain functions receive already validated values. |
| Styling/garden | Authored CSS, CSS Modules, inline authored SVG | No component kit, rendering engine, canvas dependency, or hosted image dependency. |
| Unit/integration tests | Vitest; integration tests against real PostgreSQL | Pure rules get fast exhaustive tests; constraints, clock behavior, transactions, and races need a real DB. |
| E2E | Playwright, three core Chromium journeys | Exercise browser behavior and authz with a dedicated ephemeral test DB. Real provider OAuth is a separate manual check. |
| State | Server Components + URL for navigable state + small local UI state | Server owns authoritative completion/garden state. No global client store, React Query, or duplicate business state. |
| Hosting | Vercel Hobby + independently provisioned Neon Free | Subject to no-card eligibility/manual onboarding verification in `04-free-tier-verification.md`; no Marketplace DB provisioning. |

The GitHub-only login limits the audience to users with a GitHub account. This tradeoff keeps the MVP small and removes password reset/email infrastructure. Approving Phase 0 accepts that audience and the Auth.js beta risk; incompatible dependencies discovered in Phase 1 return to design instead of silently changing auth or storage.

## Source structure and naming

Proposed folders (no source tree is created in Phase 0):

| Path | Responsibility |
|---|---|
| `src/app/` | App Router layouts, pages, auth callback route, route handlers, request-time composition. |
| `src/features/auth/` | Auth.js configuration, current-user adapter, first-login timezone onboarding. |
| `src/features/habits/` | Habit input schemas, application services, scoped repositories, UI. |
| `src/features/checkins/` | Today's completion action/service and pure streak rules. |
| `src/features/garden/` | Pure growth/unlock rules, fixed-slot catalog reads, SVG UI. |
| `src/shared/domain/` | Domain value types and error codes that have no React/DB/framework imports. |
| `src/shared/server/` | Lazy environment validation, DB factory, transaction helper, authorization, error mapping. Mark with `server-only`. |
| `src/db/schema/` | Drizzle tables/relations separated from connection creation. |
| `src/db/migrations/` | Committed ordered SQL, Drizzle metadata, migration journal. |
| `src/db/seed/` | Guarded local development/test fixtures and catalog definitions. |
| `src/components/` | Shared accessible presentation primitives, only when reused. |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Pure rules, DB invariants/races, and browser journeys respectively. |
| `scripts/` | Validated DB setup/migration/release verification entry points. |
| `.github/workflows/` | CI and protected production deployment workflows, created only after approval. |

Use PascalCase for React components/types, camelCase for functions and values, kebab-case filenames, snake_case PostgreSQL names, and uppercase machine-readable error codes. Colocate feature UI/actions/schemas with the feature. Tests name the observable behavior and refer to fixtures explicitly. Avoid generic `utils` files and one repository that exposes all tables to UI code.

## Layer contract

The call path is UI → Server Action/route → validated authenticated application service → transaction and scoped repository → PostgreSQL. Domain functions are called by services and return values; they do not perform I/O. A UI component never imports a DB connection or invents a streak/growth value.

| Layer | Allowed work | Must not do |
|---|---|---|
| UI | Render server DTOs, collect inputs, accessible pending/errors, request revalidation | Trust client ownership, derive authoritative time, import secrets, SQL, optimistic growth. |
| Boundary | Resolve database session, parse Zod schema, call service, map safe result | Accept a client user ID as authority or expose raw provider/SQL errors. |
| Service | Enforce ownership and lifecycle, take locks, obtain authoritative date, update projections atomically | Calculate business rules differently from pure domain functions. |
| Domain | Streak transition, effective display streak, growth stage and unlock eligibility | Read system clock, DB, environment, OAuth, React, network, or mutate input. |
| Repository | Parameterized SQL, explicit ownership predicates, DTO projection | Return another user's data, accept unvalidated raw SQL/sort expressions. |

Every authenticated operation resolves `session.user.id` server-side. Explicitly configure the Auth.js database-session callback to copy the adapter's `user.id` into `session.user.id`, with matching TypeScript augmentation; calling `auth()` alone is not proof that this field is populated. Repositories receive this ID explicitly and constrain every private read and write by it, including joins, updates, nested resources, and reward reads. Child-table composite foreign keys add a database ownership check; they do not replace application checks. The plant catalog is public read-only data. A resource that is missing or belongs to another user returns the same safe not-found result.

Domain specifications are `guardExpectedDate(expected, authoritative)`, `advanceStreak(previous, acceptedDate)`, `projectCurrentStreak(streak, asOfDate)`, `advanceGarden(previousTotal, catalog)`, and `projectPlant(total, catalogPlant)`. Plant points equal total minus that plant's unlock threshold. Dates are validated calendar dates, compared with calendar arithmetic rather than fixed 24-hour milliseconds. Clocks and current local dates are service inputs to pure logic. Exact behavior is defined in `01-data-design.md`.

## Authentication and onboarding

Use a GitHub OAuth app per environment: local/test-provider configuration and production have different allowed callback URLs. Do not assume one OAuth app can support all preview domains. Previews are not required for MVP. Store Auth.js account/session rows through its adapter. Keep standard Drizzle adapter property names while mapping physical names explicitly: `emailVerified` → `email_verified_at`, `userId` → `user_id`, `providerAccountId` → `provider_account_id`, `sessionToken` → `session_token`, and `expires` → `expires_at`. Preserve standard token-field mappings, user UUID/default behavior, and the session callback through adapter integration tests. GitHub identity is the provider account ID, not an editable username or a client email claim. Do not enable dangerous email account linking. Account token columns required by the adapter are private server-only data; never select them for UI or logs. Request minimal provider scopes and no repository access.

An authenticated new account must choose and confirm an IANA timezone before creating habits/completions. The UI may suggest the browser zone, but the server validates it and the user confirms it. After onboarding, the timezone cannot change in MVP. Onboarding, initial garden state, and starter plant are idempotent and serialized by the user lock; a login retry must not duplicate rewards. The local seed creates fictional development data in a guarded local DB and does not supply production credentials.

Use Auth.js managed database-session cookies: HttpOnly, appropriate SameSite, Secure in production, expiration, and sign-out revocation. Preserve Auth.js origin/CSRF protections and Next.js Server Action origin checks; do not implement a GET mutation. State-changing services remain authenticated even if invoked outside the intended page. External OAuth connectivity is required for a real local sign-in; local DB and seeded fixtures do not depend on a hosted database.

## Build and runtime behavior

`next build` must succeed without a reachable database, GitHub credentials, or an Auth.js secret. Separate schema/type imports from connection setup. Validate runtime secrets and create connection pools lazily when an authenticated runtime request needs them. Do not connect or fetch protected data at module scope, build-time metadata generation, or static prerender. Mark protected pages request-time using the currently documented Next.js request-time mechanism (`connection()`), and verify this with network-isolated build tests. Missing runtime configuration produces a safe unavailable state and a redacted server error; it must not silently choose a test auth mode.

Use one small bounded `pg` pool per running process, with timeouts and clean test teardown. Production runtime uses Neon's pooled endpoint. Production migration credentials use a direct endpoint and are absent from Vercel runtime. Transactions must fit comfortably within the verified free function duration; do not keep transactions open across network calls or OAuth redirects. Server reads for private user data are request-scoped; never put private DTOs in a shared public cache. Revalidate affected authenticated routes after successful mutation. Show authoritative state after the response; duplicate clicks are disabled while pending and still handled idempotently server-side.

## Errors, security, and observability

Validate text lengths, UUIDs, calendar dates, IANA timezone IDs, and all environment variables. Trim habit labels and render them as text; do not use raw HTML. Limit active-habit count and bounded query sizes as specified by the data design. Derive ownership and timestamps server-side. Use parameterized SQL, least-privilege runtime DB permissions, and secure TLS for hosted DB connections. Keep production migrations and deployment secrets in the protected GitHub environment, never in PR jobs or committed files. `.env.example` will contain placeholders only; `.env*` files containing secrets, OAuth state, Playwright session state, and deployment artifacts will be ignored.

Expected result codes include `UNAUTHENTICATED`, `ONBOARDING_REQUIRED`, `VALIDATION_ERROR`, `NOT_FOUND`, `HABIT_ARCHIVED`, `LIMIT_REACHED`, `DAY_ROLLED_OVER`, `TIME_ZONE_FIXED`, and `SERVICE_UNAVAILABLE`. `DAY_ROLLED_OVER` means the client must refresh today's view and explicitly try again. An existing same-day log returns a successful already-completed result without another growth increment. Map unexpected failures to a generic message with a correlation ID; redacted structured logs include operation and failure code, not habit titles, emails, tokens, SQL parameters, cookie contents, or DB URLs. Use free platform logs; retain no separate analytics pipeline.

MVP abuse controls are authenticated-only mutations, per-user serialization, label/count bounds, bounded queries, and idempotency. A distributed rate-limit service is outside MVP. Record that limitation for a small personal beta; revisit before a public large-audience launch. Account export/deletion and broader privacy controls are later product work, so the release must accurately state this limitation and avoid claims of regulatory certification.

## UI plan and acceptance

Use a single responsive dashboard with today's local date/timezone, up to 10 active daily habits, current/best streak text, garden progress, and four fixed garden slots. Sign-in and timezone onboarding are separate focused states. Plants appear automatically at lifetime totals 0, 5, 15, and 30; every owned plant grows through stages at 0, 3, 7, and 14 points after its unlock. The garden is an authored SVG; equivalent text states plant name, growth stage, and total completion progress. Use CSS transitions with `prefers-reduced-motion`; growth never depends on animation finishing.

Use semantic buttons/forms/headings, visible keyboard focus, labeled inputs, sufficient text contrast, no color-only status, and a polite live region for completion feedback. Garden slots are informational and need no drag-and-drop or editor. Touch targets are comfortably usable. Verify at 320 px and desktop widths without horizontal content overflow. Status changes do not unexpectedly move focus; validation connects messages with inputs.

| State | Required feedback |
|---|---|
| Loading/pending | Stable layout, progress label, disable the submitting control, retain existing content. |
| No habits | Clear explanation and create-habit action; starter garden remains visible. |
| Locked plant slot | Explain its next completion threshold without an unexplained disabled action. |
| Completed today | Checked status and growth feedback from returned server state. |
| Missed day | Effective streak reads zero when appropriate; best/total and garden remain. |
| Day rollover | Explain that the day changed, refresh authoritative date, require a new deliberate submit. |
| Failure/offline | Preserve typed input, give retry, do not show a success/growth animation. |
| Archived habit | Remove from active list, preserve historical totals; no completion or reactivation controls. |

## Test strategy and completion evidence

| Level | Minimum evidence |
|---|---|
| Unit | First/same/next/skipped-day streaks; display expiry; leap/month/year boundaries; no timezone/DST millisecond arithmetic; every growth and unlock boundary; archived rejection represented in service tests. |
| Integration | All constraints and owner isolation; real adapter persistence; idempotent concurrent completion; different-user parallelism; same-user different-habit serialization; transaction rollback; post-lock clock across midnight; onboarding once; fixed catalog restrictions; archive/log race; local-only seed guards and production migration safeguards. |
| E2E 1 | First visit/sign-in-required UI, database-session onboarding, create habit, complete once, streak and SVG text advance after refresh. |
| E2E 2 | Repeated submit/reload keeps one log and one increment; archive removes active habit and preserves totals; empty/error/day-change states through controlled test fixtures. |
| E2E 3 | Second user's data cannot be read/mutated; keyboard create/complete/archive, responsive narrow viewport, reduced-motion behavior. |
| Manual | Real GitHub OAuth round trip in local and production, sign-out/session revocation, timezone confirmation, mobile/keyboard smoke. This is not replaced by fake provider success. |
| Build/release | Format, lint, typecheck, unit, PostgreSQL integration, build without DB/secrets, e2e, then staged and canonical deployment smoke. |

For automated e2e, a test-runner fixture writes real Auth.js user/session records directly to a dedicated ephemeral loopback PostgreSQL test database and sets the normal session cookie through Playwright. The fixture must fail closed unless the database is explicitly designated disposable test data. No login-bypass route, test-login environment mode, hardcoded session, or public fixture endpoint exists in application code. Test authentication demonstrates session/app behavior; it does not claim to test GitHub's OAuth exchange.

Do not write tests that simply mirror implementation. Prioritize externally observable invariants and the concurrency/security boundaries. `bash check.sh` will be the documented aggregate local gate; it does not exist yet. No lint, typecheck, tests, build, migrations, or browser checks have run in Phase 0.

## Official references inspected

- [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint), and [request-time connection](https://nextjs.org/docs/app/api-reference/functions/connection).
- [Auth.js installation](https://authjs.dev/getting-started/installation) and [Next.js reference](https://authjs.dev/reference/nextjs).
- [Node.js release status](https://nodejs.org/en/about/previous-releases).
- [Playwright authentication fixtures](https://playwright.dev/docs/auth).
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

Version-sensitive APIs, exact package compatibility, and pinned patches must be rechecked at the Phase 1 install boundary; these sources do not establish that this unbuilt app works.
