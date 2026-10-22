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

Phase 1 will add the actual local setup/env/run/test instructions and `.env.example` with placeholders only. Phase 2 will add verified free-account/OAuth/secret instructions and CI/deployment evidence. Until `bash check.sh` and the relevant acceptance checks actually pass, the application must not be called complete.

For another agent, start with [AGENTS.md](AGENTS.md) and [STATUS.md](STATUS.md); use [PROJECT_FRAME.md](PROJECT_FRAME.md) as the design routing map. Do not rerun environment setup or advance into code merely because this README exists.
