# Habit Garden — acceptance gates

Updated: 2026-10-23, Asia/Kuala_Lumpur. P0 and AC01–AC12 are approved. Tasks2–4 have scoped format/lint/typecheck/unit/real-PostgreSQL/build evidence in [STATUS](STATUS.md) and [GIT_FILE](GIT_FILE.md). **The complete application gate remains pending: `check.sh` and browser journeys do not yet exist, and real OAuth, CI and deployment have not passed.** The requirements below define the remaining acceptance evidence.

## Local prerequisites and command contract

Use the approved supported Node 24 LTS patch, lockfile, usable Bash, Docker Linux engine, and local PostgreSQL. Read-only prerequisite probes are `node --version`, `npm --version`, `git --version`, `bash --version`, and `docker info`; their availability is not a functional-app pass. Never substitute an unrelated DB volume or a hosted DB for disposable tests.

Create these scripts during the scaffold/implementation tasks. Until they and meaningful suites exist, mark the corresponding result unavailable rather than pass. No empty-test success flags, placeholder passing tests, or swallowed failure exit codes.

| Command                    | Required result                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Install only exact lockfile dependencies from the approved set.                                                                                                               |
| `npm run format:check`     | Check committed source/config/docs formatting without changing files.                                                                                                         |
| `npm run lint`             | Explicit ESLint check, independent of build.                                                                                                                                  |
| `npm run typecheck`        | Strict TypeScript validation.                                                                                                                                                 |
| `npm run test:unit`        | Real domain boundary/date/streak/growth tests.                                                                                                                                |
| `npm run db:migrate`       | Apply reviewed SQL using the journal and dedicated migration connection/lock; safe repeat is a no-op. For gates, target only verified loopback test DB.                       |
| `npm run db:seed`          | Explicit guarded local development fixture command; never part of build/CI release or production. Preserve existing/conflicting data.                                         |
| `npm run test:integration` | Real isolated PostgreSQL constraints, auth adapter, permissions, races, rollback, snapshots, and target guards.                                                               |
| `npm test`                 | Aggregate meaningful unit and real-DB integration suites once both exist.                                                                                                     |
| `npm run build`            | Build with DB network and OAuth/runtime secrets absent; no import/prerender DB connection.                                                                                    |
| `npm run test:e2e`         | Three Chromium journeys against the built local server and verified ephemeral DB.                                                                                             |
| `bash check.sh`            | Aggregate format → lint → typecheck → unit → test-DB migration/integration → DB-free build → e2e; fail on every error, missing prerequisite, missing suite, or unsafe target. |
| `git diff --check`         | No whitespace errors; review actual diff separately for scope/secrets.                                                                                                        |

The aggregate gate may provision/use the explicitly verified disposable test DB and its fixtures only. It must never seed/reset/migrate production, reset the developer DB, or silently skip missing Bash/Docker/test dependencies. Tests close pools/browsers and use bounded timeouts. Individual CI commands must enforce the same invariants even if the shell wrapper is not used there.

## Observable acceptance and evidence

| ID   | Required evidence                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC01 | Adapter/session/onboarding integration tests plus browser session behavior; separate real local and production GitHub OAuth round trip and logout/session revocation. Fixture sessions alone cannot pass real OAuth.                              |
| AC02 | Valid/blank/overlong title tests, owned creation and active-list behavior; concurrent creation cannot exceed ten, archive frees capacity.                                                                                                         |
| AC03 | Real DB completion log/streak/total/reward commit and browser refresh showing the authoritative text/SVG change.                                                                                                                                  |
| AC04 | Concurrent same-habit/date exactly-once reward; midnight queued/lost-response retry rejection; duplicate UI has no extra growth.                                                                                                                  |
| AC05 | First/consecutive/missed/duplicate/display-expiry unit tests, leap/month/year boundaries, DB timezone tests for America/New_York DST and Asia/Kuala_Lumpur; best/garden survive misses.                                                           |
| AC06 | Stage boundaries 0/2/3/6/7/13/14 and unlock totals 4→5, 14→15, 29→30; zero points on unlock, starter once, mature cap, no duplicate unlock.                                                                                                       |
| AC07 | Archive replay/retention, archive-first versus completion-first race, same-day duplicate after archive, UI removal with preserved totals.                                                                                                         |
| AC08 | Foreign/missing ID equivalent not-found, every private query scoped, no/expired session blocked, composite ownership FKs, runtime deletion/timezone/catalog restrictions, browser second-user isolation.                                          |
| AC09 | Empty local DB migrations and repeat no-op, guarded seed twice without overwrite, conflict/hosted/ambiguous target rejection, documented local Docker setup. Local real OAuth prerequisite stays explicit.                                        |
| AC10 | 320 px and desktop keyboard/mobile smoke; labels/focus/announcements/contrast/text garden/reduced motion/loading/empty/error/day-change states. Failed/pending actions never show rewards.                                                        |
| AC11 | Actual successful full `bash check.sh` output plus PR and fresh-main quality runs for their exact SHAs; DB-free build and safe isolated tests demonstrated.                                                                                       |
| AC12 | Actual free/no-card eligibility, reviewed source SHA, migration journal, staged READY/read-only smoke, same-deployment promotion, canonical SHA/readiness smoke, recorded real URL and limitations, separate real production OAuth/manual action. |

Required e2e journeys: (1) sign-in-required → fixture session onboarding → create → complete → refresh streak/garden; (2) duplicate/reload → archive/retention plus controlled empty/error/day-change; (3) owner isolation plus keyboard/narrow-screen/reduced-motion behavior. Fixtures create real sessions only from test-runner code in a verified loopback DB; there is no app fixture route or login-bypass mode. No production e2e fixture/reset.

## CI and release gates

Every PR and main push runs exact-SHA format/lint/type/unit/real-DB integration/DB-free build/e2e on an unprivileged runner with ephemeral PostgreSQL. Production secrets are absent from PR/quality checks. All gates are required for one quality result; passing local checks cannot establish GitHub workflow success.

Only a successful trusted main quality run hands off the exact SHA to the protected serialized release. Before migration and promotion, verify remote main still equals that SHA. Hold a dedicated direct-session advisory lock for reviewed additive migrations; stage a production build without canonical domain assignment, await READY, check baked SHA/readiness/public and protected-entry behavior, promote that same deployment, and repeat canonical checks. Follow [03-cicd-plan](docs/03-cicd-plan.md) for full security/failure/recovery details. No production seed/reset/destructive migration or automatic schema rollback.

## Evidence record and completion language

Record command, time, exact source SHA, safe target identity, exit/result, real test summary, and outstanding checks in `GIT_FILE.md` immediately after each step. Record commit hashes only once they exist. A release adds actual workflow/deployment links, migration IDs, staged/canonical SHA conclusions, free-tier limitations, manual OAuth result, and any recovery action. Keep secrets, personal data, auth state, and traces out of public logs/artifacts.

“Designed”, “implemented”, “tested locally”, “CI passed”, and “deployed” are separate claims requiring their own evidence. An unavailable/failed/unrun gate remains pending or blocked, never passed. Approval authorizes work; it does not satisfy an acceptance test. Update this checkpoint's status as actual scripts and results become available.
