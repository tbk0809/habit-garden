# Project frame — design routing

Status: approved for implementation on 2026-10-22, Asia/Kuala_Lumpur. The user approved Phase 0, P0, AC01–AC12, existing dependencies, personal/noncommercial use, and personal public source publication, and explicitly authorized coding. This records decisions; it does not claim installed packages, working features, or passing checks. Product source: [PRD.md](PRD.md).

## 1. Approved stack

User-fixed: Next.js, TypeScript, PostgreSQL. Approved additions: Node 24 LTS, Drizzle ORM/Kit and `pg`, Auth.js with its Drizzle adapter and GitHub OAuth/database sessions, Zod, Vitest, Playwright, ESLint, Prettier, and authored SVG/CSS/CSS Modules. Freeze exact compatible versions and the supported Node patch from official sources before installation. Auth.js beta compatibility remains a verification task, with its accepted risk described in [architecture](docs/02-architecture.md). A compatibility conflict returns to design; do not substitute auth, storage, or a paid service.

## 2. Modules and directories

One App Router monolith with feature modules for auth/onboarding, habits, checkins/streaks, and garden. UI → validated authenticated Server Action → service → scoped repository/transaction → PostgreSQL is the only write path. Domain functions calculate dates/streaks/growth without I/O. UI never imports SQL, connections, or secrets and never awards optimistic growth.

| Directory | Responsibility |
|---|---|
| `src/app/` | Layout, public sign-in, onboarding/dashboard composition, Auth.js handlers, status/readiness handlers. |
| `src/features/auth/` | Auth.js configuration, database-session current user, timezone onboarding. |
| `src/features/habits/` | Create/archive inputs, actions, services, scoped repository, habit UI. |
| `src/features/checkins/` | Completion action/service, pure streak transitions and display projection. |
| `src/features/garden/` | Pure growth/unlock functions, catalog projections, authored SVG and text. |
| `src/shared/domain/` | Validated date/value types and safe error contracts; no framework/database imports. |
| `src/shared/server/` | Server-only lazy environment/DB factories, transaction/auth helpers, redacted errors. |
| `src/db/schema/`, `src/db/migrations/`, `src/db/seed/` | Adapter-compatible tables, reviewed SQL/journal, guarded fictional local fixtures. |
| `src/components/` | Presentation primitives only where reused. |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Pure rules, real PostgreSQL invariants/races, three browser journeys. |
| `scripts/`, `.github/workflows/` | Guarded DB/release entry points and later CI/deployment. |

Use kebab-case filenames, PascalCase components/types, camelCase functions/values, snake_case SQL names, and uppercase safe error codes. The exact DTOs and five pure-domain contracts are in [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md); interactions are in [FLOWS.md](FLOWS.md). These documents freeze the existing design rather than add scope.

## 3. Data model

The nine-table ER model, keys, indexes, ownership constraints, post-lock date logic, transaction order, seed safety, and migration strategy are in [01](docs/01-data-design.md). Do not duplicate or change thresholds independently in UI or seed data.

## 4. Runtime environments

Local: Docker Compose PostgreSQL plus local Next.js; tests: separate disposable loopback PostgreSQL. Approved production choice: Vercel Hobby and directly provisioned Neon Free, subject to actual no-card checks. Runtime uses a least-privilege pooled connection; migrations use a separate direct connection and dedicated session advisory lock. Production secrets never enter PR checks or repository data. The user's publication approval covers application source only.

`next build` must run without a reachable DB, GitHub credentials, or Auth.js secret. Connection/env validation is lazy and server-only; protected reads are request-time, use one coherent snapshot, and never enter a shared public cache. The Auth.js session callback explicitly supplies `session.user.id`; repositories receive that server-derived ID and constrain all private queries by it.

## 5. Release and verification

[03](docs/03-cicd-plan.md) owns CI/release design; [04](docs/04-free-tier-verification.md) owns sourced service evidence; [05](docs/05-task-breakdown.md) owns ordered execution tasks. [GATES.md](GATES.md) specifies acceptance commands and evidence. At this document checkpoint no CI/workflow/check script exists or has passed. No production seed, reset, or destructive migration is authorized. Phase 0 headers in the six historical design documents record their draft-time state; the 2026-10-22 approval recorded here and in PRD/checklist is the current execution authority.

## 6. API / Mock decision

Use real PostgreSQL-backed Server Actions for first-run timezone, habit creation/archive, and daily completion. Auth callback/session routes are handled by the selected library. Only minimal read-only status/readiness endpoints are planned for smoke checks; there is no separate public REST backend or externally exposed admin/fixture API.

Automated tests may create normal Auth.js database sessions directly in the isolated test DB. That is test-runner setup, never a product login bypass or a claim that real GitHub OAuth was tested. Production has no mock auth, fixture route, test-user header, or test-mode environment switch. DTO/action/result contracts follow [01](docs/01-data-design.md) and [02](docs/02-architecture.md).
