# Current status

- Project: Habit Tracker That Grows a Garden.
- Version: `0.1.0`, unreleased local build.
- Current step: Phase 2 task 10, implement and verify unprivileged CI.
- Phase 1: tasks 1–9 implemented/documented; real GitHub OAuth acceptance remains open.
- Accepted source: `8a27c5451bbb567f0bc1a8d69a2061f2555b7ccf`, including the Windows LF checkout fix. Tasks 1–8 received independent review.
- Authorization: Phase 0/P0/AC01–AC12, existing dependencies, coding, personal/noncommercial use and personal public-source publication were approved on 2026-10-22. The user requested all remaining work on 2026-10-23.
- Git: local `codex/habit-garden`; no remote or push yet.
- Live URL: none.

## Verified local evidence

On 2026-10-23 at 17:39 MYT, the clean checkout of `8a27c54` completed the full Git for Windows `bash check.sh`: format, lint, strict typecheck, **173 unit tests**, **45 real PostgreSQL integration tests**, credential-free production build and **3 Playwright journeys**, exit 0 with no skips. The build reports the full source SHA and `sourceDirty=false`; Git status is clean. Its prior lockfile-only install added 214 packages. The failed `440dcdf` checkout and its CRLF diagnosis remain preserved.

Browser coverage includes real database sessions, expiry/sign-out, timezone onboarding, validation focus, pending without premature rewards, unlock/stage feedback, refresh, dropped-response idempotence, stale-day rejection, archive retention, ownership, keyboard and 320px layout, contrast and reduced motion. Status resists runtime/request SHA spoofing; readiness returns 200 with DB and generic 503 without it. These fixtures do not verify GitHub's provider exchange.

The runtime is Node 24.22.1/npm 11.19.1, PostgreSQL 17.11 digest-pinned, and installed Edge on Windows. Development/test ports are 55434/55433. Only the guarded `habit_garden_test` schema is rebuilt by tests. The afternoon Docker startup again hit stale runtime sockets; checked socket-only directories were preserved as sibling backups, after which engine 29.1.2 and both existing containers became healthy. No volume/image/WSL database reset occurred. See [ERRORS](ERRORS.md).

## Remaining work

1. Implement CI, publish the authorized personal repository, and verify actual PR/main runs.
2. Verify account plans/no-card project creation and configure protected production secrets.
3. Implement and verify serialized migration, staged production smoke and same-deployment promotion.
4. Verify real local/production OAuth and deliberate user-owned acceptance; record the live URL and seven-part handover.

Current browser inspection confirms GitHub `tbk0809`, Vercel workspace `tbk0809's projects` on Hobby, and an existing Neon account on Free ($0/month) with no projects. No new cloud resource, token, secret or repository has been created in this resumption. Public service terms were independently rechecked; account provisioning is not yet acceptance.

Private env files and browser state remain ignored. Historical dependency audit: production 0 findings, development 8 affected nodes; see the dated [dependency record](docs/07-dependency-pins.md). No fresh clean audit is claimed. The stopped quota-resume work remains stopped.

Start with [README](README.md), [prompt audit](docs/06-prompt-audit.md), [ordered tasks](docs/05-task-breakdown.md) and [GIT_FILE](GIT_FILE.md). A failed or unrun cloud check remains open even when local tests pass.
