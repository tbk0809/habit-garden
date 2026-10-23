# Phase 0 — Ordered implementation checklist

Status: **entry approval granted; tasks1–7 local implementation reviewed; task8 automated local acceptance passed; task9 documentation/reproduction passed (2026-10-23)**. Original plan date: 2026-10-21, Asia/Kuala_Lumpur. Authorization comes from the user's explicit responses, not from this checklist's existence. No working application is claimed yet.

## Entry gate and execution rules

- [x] User approves the six Phase 0 documents, P0, observable acceptance criteria, and proposed dependencies/services (2026-10-22).
- [x] User explicitly replies “批准 Phase 0，开始写代码” (2026-10-22). The original approval stop is satisfied.
- [x] User confirms personal/noncommercial use and permits personal public source publication (2026-10-22). Vercel standalone no-card signup remains a later pre-provisioning check; if it fails, return to hosting design.

Read `../AGENTS.md` routing/status before resuming. These six Phase 0 documents are authoritative design proposals; `../PRD.md` is their concise product acceptance index and `../PROJECT_FRAME.md` is a routing pointer. Approving them advances the project-framework/interaction/handoff steps explicitly; do not silently skip the local workflow. Before feature code, record the approved framework in `PROJECT_FRAME.md`, interaction contracts in `FLOWS.md`, and executable scope in `FRONTEND_HANDOFF.md`, without adding features.

For **every step**, append to `GIT_FILE.md` immediately with time, phase, reason, files, commands, result, commit or none, and follow-ups. Never batch entries or rewrite history. If a design changes, document the reason and update the affected specification before implementing it; a conflicting core choice returns to the earliest affected approval gate. Keep secrets and test session state out of all logs/artifacts.

After each application step run `npm run lint`, `npm run typecheck`, and meaningful applicable tests (`npm test` will aggregate unit + real PostgreSQL integration once those exist), plus formatting. Then commit with Conventional Commits. Do not use empty-test success flags or placeholder tests to claim a pass. During initial environment/docs work before those scripts exist, record them as unavailable; combine the first functional commit with its meaningful domain tests. Record the actual commit hash in a subsequent append-only log entry, rather than inventing a hash before the commit. Do not amend old log entries to insert later hashes.

Run the complete `bash check.sh` gate after integrated features and before any build/release claim. If Bash/Docker/Git is unavailable, diagnose/record the actual issue; do not waive acceptance or announce success. Do not delete existing data, modify unrelated repos/global settings, choose a paid service, or install a newly proposed dependency without the applicable approval.

## Phase 1 — Build, in dependency order

### 1. Repair/verify the local prerequisites and establish approved records

- [x] Verified project Git/Bash outside sandbox, Docker 29.1.2 Linux after preserved runtime-socket repair, and checksum-verified local Node 24.22.1 (2026-10-22). Historical failures and repair evidence remain in `../ERRORS.md`.
- [x] Initialized an independent project repository on `codex/habit-garden`, using existing configured identity; unrelated ancestor repository/global settings untouched.
- [x] Recorded granted approval and created approved PROJECT_FRAME/FLOWS/FRONTEND_HANDOFF/GATES records; execution log appended at each step.
- [x] Froze reviewed exact compatible packages and Node patch in `07-dependency-pins.md`; actual install/tests remain next. Auth.js beta risk was approved; no auth/storage replacement selected.

Completed evidence: runtime/Git/Bash/Docker probes and approved records; committed as `aa36bd2` and `2d99a0d`. Application checks were introduced in subsequent tasks.

### 2. Scaffold the minimal typed app and developer gates

- [x] Create Next.js App Router structure from `02-architecture.md`, TypeScript strict configuration, CSS Modules, explicit ESLint and Prettier commands, Vitest/Playwright config, lockfile, and runtime version pins.
- [x] Add `.gitignore` for secrets, browser auth state, local DB data, build/deploy artifacts; `.env.example` with placeholders; lazy runtime env validation and no DB network at import/build.
- [x] Define `format:check`, `lint`, `typecheck`, `test:unit`, `test:integration`, `test`, `build`, `test:e2e`, `db:migrate`, and `db:seed` scripts with safe targets. Add `check.sh` only when its constituent meaningful checks exist; absent prerequisites must fail, not silently skip.
- [x] Continue directly to Step 3's domain tests before the first functional commit if the scaffold alone has no meaningful test target.

Future commands: `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`; `npm run build` with DB/OAuth config absent. Proposed commit together with tested scaffold/domain: `feat: establish typed app and tested garden rules`.

### 3. Implement and test pure date, streak, and growth rules

- [x] Implement validated civil-date values and the five domain contracts from `01-data-design.md` with no runtime clock/framework/DB imports.
- [x] Test first/consecutive/missed/duplicate/expiry cases, month/year/leap dates, stage boundaries, unlock zero-points, and mature cap. Timezone conversion is not a pure-domain clock dependency.
- [x] Verify no undo/backfill/reactivation, random plants, placement editor, schedule feature, or separately stored stage has entered scope.

Future commands: format/lint/typecheck + `npm run test:unit`; run integration only when a real DB suite exists, recording its earlier absence. Proposed commit if separate from scaffold: `feat: implement deterministic streak and growth rules`.

### 4. Add local PostgreSQL, schema, reviewed migrations, and safe seed

- [x] Add `docker-compose.yml` for a pinned official PostgreSQL image, loopback port, named volume, health check, explicit local-only credentials, and no destructive reset command in ordinary setup.
- [x] Add nine Drizzle tables, keys/checks/partial indexes/immutable guards, adapter mappings, runtime/migration roles, and four fixed catalog rows via reviewed migration.
- [x] Add one-session advisory-lock migration runner and migration journal, plus guarded idempotent local seed with two fictional users. Repeated seed must not overwrite conflicting data; no production seed/reset code path.
- [x] Test migrations from empty DB and repeat no-op, ownership FKs, immutable histories/timezone, role privileges, and seed target guards against hosted/ambiguous DBs.
- [x] Document real local OAuth needs separately from seeded users. Test fixtures use a distinct disposable DB, not the developer DB volume.

Future commands: `docker compose up -d db`, `npm run db:migrate`, explicit guarded `npm run db:seed`, and format/lint/typecheck/unit/integration. Proposed commit: `feat: add postgres schema migrations and local fixtures`.

### 5. Add GitHub OAuth, database sessions, and timezone onboarding

- [x] Configure Auth.js with GitHub-only OAuth and real adapter sessions, minimal scopes, no unsafe email linking, and proper cookies/sign-out. No hardcoded/test login route or auth-bypass environment flag.
- [x] Add authenticated boundary helpers, redacted errors, scoped repository types, and runtime-only secret validation.
- [x] Confirm supported IANA zone explicitly once; under user lock atomically initialize zone, garden count 0, and starter plant. Test repeat/concurrent/conflicting/missing-state cases.
- [x] Add test-runner-only loopback session fixtures and scoped browser smoke; task5 commit `cca18c9` passed independent spec/quality review with132unit/23PG checks. Actual GitHub OAuth remains unverified without real credentials and is carried to the manual acceptance gate.

Future commands: format/lint/typecheck + `npm test`, DB-free build, targeted browser auth/onboarding checks. Proposed commit: `feat: add github sessions and timezone onboarding`.

### 6. Implement scoped habit creation, listing, and archive

- [x] Add validated labels, 10-active cap, user-first locking, atomic zero streak creation, coherent dashboard query, and archive with retained history.
- [x] Test title bounds, cap under concurrency, archived capacity, missing/foreign resources, no/expired session, and role-level deletion denial.
- [x] Implement minimal forms and pending/empty/errors so the service paths can be exercised; no edit/reactivation/delete UI.

Future commands: format/lint/typecheck + `npm test`; scoped browser smoke. Proposed commit: `feat: add owned daily habits and archive`.

### 7. Implement atomic completion and fixed-slot garden

- [x] Implement the exact completion protocol: user lock → post-lock DB clock → authoritative local date → stale-date guard → duplicate check before archive rejection → insert → streak/total/unlock → commit.
- [x] Add real concurrency/rollback/midnight tests, including different-habit same-user work, archive-first/complete-first, duplicate-after-archive, lost-response next-day retry, timezone DST conversion, and cache reconstruction checks.
- [x] Return consistent authoritative projections and revalidate authenticated UI. Render four fixed authored SVG slots and accessible stage/progress text. Disable repeated submit while pending and retain DB idempotence.

Future commands: format/lint/typecheck + `npm test`, DB-free build, completion/browser journey. Proposed commit: `feat: grow the garden from atomic daily completions`.

### 8. Complete responsive/accessibility states and e2e acceptance

- [x] Finish keyboard/focus/label/contrast/reduced-motion behavior, 320 px layout, day-rollover messaging, safe unavailable/retry state, archived removal, and garden unlock feedback.
- [x] Implement three Playwright journeys from `02-architecture.md` using isolated real DB session fixtures. Cover UI refresh/idempotence, archive retention, owner isolation, and keyboard/narrow-screen use.
- [x] Add or finalize `check.sh` aggregate gate; perform the real local OAuth/manual smoke if credentials are supplied. Record manual vs automated evidence distinctly.

Future commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, then `bash check.sh`. Proposed commit: `test: verify responsive habit and garden journeys`.

### 9. Finish local-run documentation and build handoff

- [x] Expand README with prerequisites, env meanings, local DB/migration/seed/run/test commands, safe rerun behavior, local OAuth setup, and troubleshooting drawn from actual results.
- [x] Record clean-clone local acceptance, dependency/version inventory, security boundaries, no-code deviations (if any), known issues, and next action in status/log/changelog.
- [x] Review the actual diff for secrets and scope drift. Run the full aggregate gate before claiming a working local app. An unavailable check remains a blocker, not a pass.

Future commands: `git diff --check`, working-tree/secret review, `bash check.sh`. Proposed commit: `docs: document verified local setup and acceptance`.

## Phase 2 — CI/CD, after working local acceptance

### 10. Implement and verify unprivileged CI

- [x] Add PR/main `ci.yml` with exact SHA, pinned actions/Node, standard Linux runner, ephemeral PostgreSQL, all gates, DB-free build, Playwright, safe summaries and timeouts (2026-10-23; actual hosted runs pending).
- [ ] Create/select the authorized personal repository and push only when publication is explicitly authorized. Configure required quality checks/branch rules supported by the chosen visibility/free plan.
- [ ] Verify real PR and main checks from workflow run URLs and exact SHAs; do not infer a pass from local tests or workflow syntax.

Future commands: full local gate and workflow validation; inspect GitHub run/jobs and actual conclusions. Proposed commit: `ci: enforce postgres and browser quality gates`.

### 11. Verify no-card account provisioning and production secrets

- [ ] Recheck current official free limits, actual account plans, personal/noncommercial eligibility, personal repository ownership, no card/trial/Marketplace requirement, and chosen regions.
- [ ] User creates/selects free accounts and confirms source visibility. Provision Neon independently. Stop if Vercel standalone onboarding requires a card; document the conflict and return to hosting design.
- [ ] Create runtime/migration DB credentials with appropriate privileges, production OAuth app callback, protected GitHub environment/secrets, Vercel runtime secrets/default domain, and explicit manual approval policy.
- [ ] Never read secrets back into log output or commit them. Record only names and verification outcomes. Do not treat account setup as a completed deployment.

Future verification: actual dashboard/account outcomes and redacted connectivity/role checks. Proposed documentation commit: `docs: record free hosting setup prerequisites`.

### 12. Implement serialized production release

- [ ] Add reusable trusted `deploy.yml`, current Vercel Git auto-deploy disable config, full-SHA/quality/main-tip checks, production concurrency without cancellation, and one-session direct migration lock.
- [ ] Implement production-config build, staged production deployment without domain assignment, READY/read-only SHA/DB smoke, fresh main-tip check, same-deployment promotion, and canonical smoke.
- [ ] Verify a failed check/migration/smoke blocks promotion and a superseded commit cannot release. Never exercise these cases with destructive production data operations or production test fixtures.
- [ ] Capture release manifest; implement manual recovery instructions that preserve the forward-compatible schema. No auto-commit loop from deployment.

Future commands: local `bash check.sh`; actual trusted workflow run with redacted deployment/migration evidence and CLI options from `03-cicd-plan.md`. Proposed commit: `ci: stage and promote verified production releases`.

### 13. Verify live acceptance and record the handover

- [ ] Confirm the real quality/deploy jobs pass for one exact current-main SHA and the canonical URL serves the captured deployment.
- [ ] Manually verify real production GitHub OAuth, explicit timezone, one deliberate user-owned habit/completion, duplicate behavior, garden text, sign-out, keyboard/mobile use, and acceptable cold start. No seed/reset/e2e fixtures in production.
- [ ] Update README, free-tier evidence if changed, STATUS/CHANGELOG/GIT_FILE, and `AGENTS.md` with actual URL, SHA, test commands/results, limits, untested cases, manual ownership steps, and known issues.
- [ ] Deliver the requested seven-part report in order. If any gate fails or account action remains, say exactly what is missing; do not claim a deployed app.

Future verification: actual workflow/deployment links and read-only live checks plus deliberate manual acceptance. Proposed commit: `docs: record verified release and operational handover`.

## Phase 0 exit status

Phase 0 produced and reviewed the six design documents. User approval was granted 2026-10-22. Tasks1–7 local code is implemented and reviewed; continue at task9 documentation and clean-checkout reproduction. Actual GitHub OAuth remains a separate pending manual gate. Scaffold/domain/database checks have run, while complete local acceptance, actual GitHub OAuth, CI and deployment remain pending. Public-source and personal/noncommercial use are approved. Exact dependency versions and local runtime are established; Vercel no-card provisioning remains unverified.
