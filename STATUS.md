# Current status

- Project: Habit Tracker That Grows a Garden.
- Version: `v0.1-setup` (approved design and verified prerequisites; no release).
- Current step: `5_前端生成代码` / Phase 1 tasks 2–3, scaffold and tested pure domain next.
- Current objective: commit/review approved design records, then implement strict typed scaffold and meaningful date/streak/growth unit tests using the frozen package versions.
- User approval: explicitly granted 2026-10-22 for Phase 0/P0/AC01–AC12/dependency proposals and starting code; personal noncommercial use confirmed; personal public source repository publication authorized. Do not ask again for these decisions.
- Application code/dependencies/database/workflows/deployment: not started.
- Git: an independent repository was initialized in this project on `codex/habit-garden` on 2026-10-22. No commits or remote yet. Host Git/Bash work outside the sandbox; the earlier sandbox Git probe had been reaching an unrelated ancestor repository, which was not modified.
- Live URL: none.

Start with [README.md](README.md) for document links. [PRD.md](PRD.md) separates requirements, proposed defaults, exclusions, and acceptance. Detailed decisions live in `docs/00` through `docs/05`; [prompt audit](docs/06-prompt-audit.md) maps the original requirements to current evidence and remaining work. [GIT_FILE.md](GIT_FILE.md) records actions and the interrupted environment setup detour without rewriting history.

## Verification evidence and limits

Document presence, internal consistency, required coverage, and local links are the Phase 0 review targets. They do not establish a working app. Application format/lint/typecheck/unit/integration/e2e/build, `bash check.sh`, real OAuth, CI, migrations, and deployment have not run. Do not mark the product complete.

Host Git and Git Bash work outside the sandbox; a separate project repository is established. Project-local Node 24.22.1 is checksum-verified and pinned without changing system Node. Docker's two stale runtime socket directories were preserved as backups; a fresh probe now returns `29.1.2 linux`. See [ERRORS.md](ERRORS.md) for historical failures and repair evidence. Actual PostgreSQL/migrations/integration still await implementation.

The preferred Neon Free terms are sourced, but actual account provisioning has not occurred. The 2026-10-22 review corrected a Marketplace-terms misreading and confirmed public all-plan automation bypass availability; actual project configuration/access remains unverified. Vercel standalone no-card project creation remains unverified. The user authorized a personal public source repository; no remote, push, or source publication has occurred yet.

## Next action

Follow [05-task-breakdown.md](docs/05-task-breakdown.md) from its first unchecked task; the entry approval gate is now satisfied. Recheck prerequisites and dependency compatibility before installation. If a confirmed constraint conflicts with the design, return to the earliest affected decision for approval; do not silently add paid services or change stack.

The user stopped further quota-resume setup/diagnosis and requested returning to Habit Garden. Do not resume that detour automatically. Its partial environment results remain in the append-only log; no real recovery-cycle success is claimed.
