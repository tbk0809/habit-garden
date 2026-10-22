# Habit Garden — approved product scope

Version: v0.1-build-plan. Original date: 2026-10-21, Asia/Kuala_Lumpur. **Phase 0, P0, and AC01–AC12 approved 2026-10-22; implementation authorized, not yet verified.**

## Facts and purpose

The user requests a working, eventually deployed habit tracker where completed habits grow a virtual garden, maintain streaks, and unlock plants. Required foundations are Next.js, TypeScript, PostgreSQL, local Docker Compose PostgreSQL with seed data, tests, CI/CD, `.env.example`, current sourced free-tier checks, and an append-only `GIT_FILE.md`.

All tools/services must be free with no credit card or paid plan. Phase 0 produced six design documents and stopped for approval before application code. The user granted that approval and explicitly authorized coding on 2026-10-22. The earlier executive-assistant description is superseded by this explicit Habit Garden request; no earlier project files were found or overwritten.

## Approved positioning and P0

The first release targets a person who wants a simple, encouraging daily routine. The user confirmed personal, noncommercial use and GitHub-account login on 2026-10-22.

Approved P0:

- GitHub OAuth login/logout with database sessions; explicit first-run IANA timezone confirmation, then immutable timezone.
- Create and list up to 10 active daily habits, with trimmed titles of 1–80 characters.
- Complete an owned habit once per authoritative local date; same-day duplicates do not add rewards. No client-selected completion date.
- Show effective current streak, best streak, and a garden that retains earned growth after a missed day.
- Unlock four fixed-slot plants at lifetime completion totals 0, 5, 15, and 30. A plant's points equal total minus its unlock threshold; stages change at 0, 3, 7, and 14 points.
- Archive habits while retaining their logs, streak history, lifetime rewards, and plants.
- Responsive keyboard-accessible dashboard, loading/empty/error/day-change feedback, and text equivalent to the SVG garden.

The exact behavior is authoritative in [data design](docs/01-data-design.md). The user approved these numerical defaults and existing architecture, dependency, and service choices on 2026-10-22. [Flows](FLOWS.md) and [frontend handoff](FRONTEND_HANDOFF.md) specify their implementation contracts without expanding P0.

## Deliberately later

Custom schedules, habit editing/reactivation, backfill, undo, reminders, social features, payments, email/password login, calendar integrations, garden rearrangement, plant inventory, themes, AI features, analytics subscriptions, and account export/deletion UI are excluded from P0. There is no timer or cron job needed to grow plants. Future requests that change date semantics or data retention return to product/data design first.

## Observable acceptance

All items below are **pending implementation and verification**.

| ID   | Acceptance condition                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC01 | A real GitHub OAuth round trip creates/loads the correct account; first login requires timezone confirmation. Logout revokes access; absent/expired sessions cannot mutate data.                                                                           |
| AC02 | Valid titles create owned daily habits; blank/overlong titles and an eleventh active habit are rejected. Concurrent creation cannot bypass the cap.                                                                                                        |
| AC03 | Completing a habit persists one log, advances the appropriate streak, adds one lifetime completion, and updates garden text/SVG after refresh.                                                                                                             |
| AC04 | Repeated/concurrent same-habit/day submissions create exactly one log/reward. A stale dashboard submitted after midnight returns a day-change error and creates no new-day completion.                                                                     |
| AC05 | Consecutive civil dates increment streaks; fully missed dates reset the effective current streak while preserving best streak and garden. Leap/month/year/DST boundaries use calendar dates.                                                               |
| AC06 | Totals 5/15/30 unlock the expected plant exactly once at zero points; stages change at each specified boundary. Duplicate requests cannot unlock or grow twice.                                                                                            |
| AC07 | Archiving removes a habit from the active list and blocks new logs, without deleting history/rewards. Completion/archive races obey the common user-lock order.                                                                                            |
| AC08 | A second user cannot read or modify another user's habits, logs, streaks, or garden, including by guessing IDs or invoking actions directly.                                                                                                               |
| AC09 | Fresh local PostgreSQL setup, migration, and guarded idempotent seed work from documented commands; existing unrelated data is not overwritten. Hosted DB access is unnecessary for local DB operation. Real local sign-in still needs GitHub OAuth setup. |
| AC10 | The app is usable at 320 px and desktop widths with keyboard navigation, labels, focus, text garden status, and reduced motion. Loading/errors never report a false reward.                                                                                |
| AC11 | `bash check.sh` and PR/main format/lint/type/unit/real-DB integration/build/e2e checks actually pass; the build needs no reachable DB or runtime secrets.                                                                                                  |
| AC12 | A free, eligible no-card deployment passes migration/staged/canonical checks for the exact tested source SHA, and its real URL plus limitations are recorded. A real OAuth/manual acceptance check is recorded separately from automated session fixtures. |

## Authorization and remaining prerequisites

The user approved positioning, P0/exclusions, exact rules, GitHub-only auth and Auth.js beta risk, observable acceptance, and the existing dependency choices on 2026-10-22, and explicitly said to begin coding. The user also permitted publishing application source to a personal public repository; this does not permit publishing personal habit data or secrets. Repository/account identities, OAuth/deployment secrets, and actual no-card provisioning still require real setup. Vercel no-card onboarding remains an unverified deployment prerequisite; no paid fallback is authorized.

Architecture, database libraries, and free services are described in [02](docs/02-architecture.md), [03](docs/03-cicd-plan.md), and [04](docs/04-free-tier-verification.md). No application completion or deployment is claimed by this PRD.
