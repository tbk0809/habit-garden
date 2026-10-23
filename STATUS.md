# Current status

- Project: Habit Tracker That Grows a Garden.
- Version: `v0.1-build` (local implementation in progress; no release).
- Current step: `5_前端生成代码` / Phase 1 task8, formal local acceptance.
- Current objective: complete three Playwright journeys, safe status/readiness endpoints and the fail-fast aggregate check.sh gate; task7 completion/garden is accepted.
- User approval: explicitly granted 2026-10-22 for Phase 0/P0/AC01–AC12/dependency proposals and starting code; personal noncommercial use confirmed; personal public source repository publication authorized. Do not ask again for these decisions.
- Scaffold/domain `3f27cfe` passed independent review. Database foundation `c152076` and layout correction `9b4f151` passed independent spec/quality review. After the move, 110 unit cases, 13 real PostgreSQL integration cases, format/lint/typecheck, migration metadata and DB/OAuth-free build passed. Development migration returned0 and safe seed replay passed; SQL bytes/hash stayed unchanged. Auth/onboarding implementation cca18c9 has132 unit/23 real-PG cases, static checks, credential-free build and scoped Edge smoke passing; independent spec/quality review PASS. Task6 implementation8bb13ab has150unit/32realPG, static/build and scoped habit-browser smoke passing; independent spec/quality review PASS after long-title wrap fix7ab8519. Task7 completion/garden is accepted in20058c3 with151unit/45PG/static/build/browser evidence; formal e2e/gates are now in progress, workflows and deployment remain unstarted.
- Git: independent project repository on `codex/habit-garden`; latest application commit `20058c3` (atomic completion and four-slot garden), independently reviewed. No remote or push. Host Git/Bash work; sandbox .git writes require host execution.
- Live URL: none.
- Fresh recovery audit (2026-10-23): compared the original prompt with source and Git. Using project-local Node24.22.1, the existing 110 domain/database/environment unit cases and 13 real PostgreSQL integration cases pass again; Drizzle metadata check passes. Independent source review found no foundation blocker. The interrupted task5 RED stub was subsequently replaced in cca18c9; foundation results alone do not cover auth/onboarding or future feature transactions.
- Dependency audit: production-only0 findings; full audit8 development-tool nodes (4 high/4 moderate) across braces/esbuild advisory chains, with actual usage/limits recorded in docs/07-dependency-pins.md. No blind major downgrade or override applied.
- Local PostgreSQL: official 17.11 image pinned by digest; healthy project dev port55434/test port55433, separate named volumes. Development migration applied and guarded seed ran twice without resetting or overwriting development data. Ignored local credentials exist; no real GitHub OAuth configuration or cloud DB is claimed.

Start with [README.md](README.md) for document links. [PRD.md](PRD.md) separates requirements, proposed defaults, exclusions, and acceptance. Detailed decisions live in `docs/00` through `docs/05`; [prompt audit](docs/06-prompt-audit.md) maps the original requirements to current evidence and remaining work. [GIT_FILE.md](GIT_FILE.md) records actions and the interrupted environment setup detour without rewriting history.

## Verification evidence and limits

Fresh task7 verification (2026-10-23): format/lint/typecheck/diff,151unit tests,45real PostgreSQL integration cases and strict empty-runtime-env host build pass. Scoped completion browser smoke passes pending/no optimistic reward, unlock live feedback, lost-response idempotent retry, stale-day refresh requiring a new deliberate click, stage feedback and320px/desktop. Independent review passed after one accessible garden-announcement fix. Formal three-journey browser acceptance, `bash check.sh`, actual GitHub OAuth, CI and deployment remain unperformed. Do not mark the product complete.

Host Git and Git Bash work outside the sandbox; a separate project repository is established. Project-local Node 24.22.1 is checksum-verified and pinned without changing system Node. Docker's stale runtime socket directories were preserved as backups; the engine returned `29.1.2 linux`, and project PostgreSQL/migration/integration checks now pass. See [ERRORS.md](ERRORS.md) for historical failures and repair evidence.

The preferred Neon Free terms are sourced, but actual account provisioning has not occurred. The 2026-10-22 review corrected a Marketplace-terms misreading and confirmed public all-plan automation bypass availability; actual project configuration/access remains unverified. Vercel standalone no-card project creation remains unverified. The user authorized a personal public source repository; no remote, push, or source publication has occurred yet.

## Next action

Follow task8 in [05-task-breakdown.md](docs/05-task-breakdown.md), then task9 local documentation/reproduction. Tasks1–7 implementation/review are complete. Browser and ops slices have disjoint ownership; one worker owns the disposable testDB/build/server while the ops slice prepares DB-free routes/gates. Actual provider OAuth needs a local GitHub OAuth app; database-session fixtures verify application paths separately. If a confirmed constraint conflicts with the design, return to the earliest affected decision for approval.

Read-only cloud readiness (2026-10-22): Chrome verifies GitHub account `tbk0809` and an existing Vercel Hobby workspace. The advertised Vercel connector is unavailable; no GitHub/Neon connector or `gh` command is available. Neon console is not authenticated. No Habit Garden remote/project/secrets were created. The user explicitly chose to finish the local application first and handle Neon later; continue local work without repeating the login request. Git push credentials, new-project no-card behavior, billing settings, and scoped deployment secrets remain unverified.

The user stopped further quota-resume setup/diagnosis and requested returning to Habit Garden. Do not resume that detour automatically. Its partial environment results remain in the append-only log; no real recovery-cycle success is claimed.
