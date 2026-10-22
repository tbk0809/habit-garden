# Habit Garden

Habit Tracker That Grows a Garden: completing daily habits grows plants, builds streaks, and unlocks a small virtual garden.

**Current checkpoint: Phase 1 task5, authentication and timezone onboarding.** The typed scaffold, pure domain rules, local PostgreSQL schema, migrations and guarded seed are implemented. The application is still under construction; full local acceptance and deployment remain pending. On 2026-10-22 the user approved Phase 0/P0/acceptance/dependencies, coding, personal noncommercial use and personal public source publication. Current evidence and remaining work are in [STATUS](STATUS.md) and the [prompt audit](docs/06-prompt-audit.md).

## Review the proposal

| Document                                                                                          | Review focus                                                                                       |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Product scope and acceptance](PRD.md)                                                            | Facts, proposed MVP defaults, exclusions, and observable acceptance.                               |
| [00 — Skills plan](docs/00-skills-plan.md)                                                        | Actual installed skills/tools and their roles.                                                     |
| [01 — Data design](docs/01-data-design.md)                                                        | Nine PostgreSQL tables, Mermaid ER diagram, keys/indexes, exact streak/growth/timezone rules.      |
| [02 — Architecture](docs/02-architecture.md)                                                      | Feature boundaries, auth, validation, UI states, and tests.                                        |
| [03 — CI/CD plan](docs/03-cicd-plan.md)                                                           | PR/main checks, migrations, staged deployment, smoke, and promotion.                               |
| [04 — Free-tier evidence](docs/04-free-tier-verification.md)                                      | Current official limits/sources and unverified signup conditions.                                  |
| [05 — Ordered tasks](docs/05-task-breakdown.md)                                                   | Phase 1/2 checklist, files, checks, and commit boundaries.                                         |
| [Execution log](GIT_FILE.md)                                                                      | Append-only actions, decisions, failures, and results.                                             |
| [Current status](STATUS.md) / [environment issues](ERRORS.md)                                     | Resumption point and prerequisites.                                                                |
| [Original-prompt audit](docs/06-prompt-audit.md)                                                  | 2026-10-22 requirement coverage, remaining work, current environment probes, and approval choices. |
| [Dependency freeze](docs/07-dependency-pins.md)                                                   | Exact compatible package/runtime pins and current support/security sources.                        |
| [Interaction flows](FLOWS.md) / [implementation handoff](FRONTEND_HANDOFF.md) / [gates](GATES.md) | Approved implementation contracts and required evidence.                                           |

## Proposed implementation

The approved stack is Next.js/TypeScript, PostgreSQL, Drizzle, Auth.js with GitHub OAuth/database sessions, Zod, Vitest, Playwright and authored SVG/CSS. Docker Compose supplies separate local development and disposable test databases. Production proposes independently provisioned Neon Free plus Vercel Hobby and a personal public GitHub repository; actual no-card provisioning and access still require verification. The user chose to finish the local application before Neon setup.

Exact versions are pinned in the lockfile and [dependency record](docs/07-dependency-pins.md), including the approved Auth.js beta. Vercel standalone no-card project creation has not been verified through a real account; no Marketplace integration or payment method is permitted.

## Setup, run, test, and deployment status

The scaffold, environment template, Compose, migrations, guarded seed and unit/real-PostgreSQL test commands exist. Tasks2–4 have scoped verification evidence. Authentication is in progress; habit services, complete garden UI, Playwright acceptance, workflows, `check.sh` and a live URL remain pending. Database-foundation tests do not prove login or complete application behavior.

Use Node **24.22.1**, npm and Docker with its Linux engine running. The version files and lockfile define the project baseline. On this workstation an ignored `.tools/node-v24.22.1-win-x64` runtime is available; prepend it to this shell's PATH if the system Node differs. A fresh checkout must supply the pinned runtime separately.

1. Run `npm ci` with the pinned Node version.
2. Create the ignored files below only if absent. Copy the relevant placeholder names from `.env.example`, replace them privately and preserve existing values. Never commit these files.
3. Run `docker compose up -d db` for development. Run `docker compose --profile test up -d db-test` for isolated tests; wait for both requested services to be healthy.
4. Run `npm run db:migrate` against the development migration URL. A repeat with unchanged SQL is a no-op.
5. Optionally run `npm run db:seed -- --local-development`. It adds/verifies two fictional users and retained habit history, creates no login identity and refuses conflicting fixture data instead of overwriting it.
6. Configure local OAuth below, then run `npm run dev` and open [localhost:3000](http://localhost:3000).

| Ignored file | Values and target                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`       | Compose `LOCAL_DB_PASSWORD` and `LOCAL_RUNTIME_PASSWORD`; choose distinct private values. Initial database credentials are set when the volumes are first created.                                                                    |
| `.env.local` | Runtime `DATABASE_URL` uses `habit_garden_runtime`; `MIGRATION_DATABASE_URL` uses `habit_garden_migrator`. Both name `habit_garden_dev` on loopback port55434. Add `AUTH_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. |
| `.env.test`  | `TEST_DATABASE_URL` uses migrator and `TEST_RUNTIME_DATABASE_URL` uses runtime, both naming `habit_garden_test` on loopback port55433. The test runner checks these targets before rebuilding its test schema.                        |

Use passwords matching the existing Compose volumes. Changing an env value does not rotate an already-created PostgreSQL login. Do not delete volumes or reset development data to resolve a credential mismatch.

For local sign-in, register a GitHub OAuth app with homepage `http://localhost:3000` and callback `http://localhost:3000/api/auth/callback/github`. Set `AUTH_URL=http://localhost:3000`, use a private random `AUTH_SECRET` of at least32 characters, and place the app's client ID/secret in `.env.local`. The application requests profile scope only. Separate local and production apps keep their credentials independent. Follow the [GitHub registration instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) and [Auth.js callback guide](https://authjs.dev/guides/configuring-github). Real provider login is still a manual acceptance step; seeded users cannot sign in.

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm run test:integration` for their respective checks; `npm test` combines unit/integration. Integration tests use and rebuild only the verified disposable test database. The build must remain independent of DB/OAuth credentials. Browser journeys and `bash check.sh` are still pending at this checkpoint; do not treat the explicit failing e2e placeholder as a pass.

Phase 2 will add verified free-account/production-secret instructions and actual CI/deployment evidence. Until `bash check.sh` and the relevant acceptance checks pass, the application must not be called complete.

For another agent, start with [AGENTS.md](AGENTS.md) and [STATUS.md](STATUS.md); use [PROJECT_FRAME.md](PROJECT_FRAME.md) as the design routing map. Do not rerun environment setup or advance into code merely because this README exists.
