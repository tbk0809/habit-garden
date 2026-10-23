# Habit Garden

Complete daily habits to grow a four-slot SVG garden. The app supports GitHub sign-in, one confirmed timezone, up to ten active habits, daily completion, current/best streaks and archive with retained history. Plants unlock at5,15 and30 lifetime completions; each slot includes equivalent stage/progress text.

The local automated gate passes: **173 unit tests, 45 real PostgreSQL integration cases and 3 Playwright journeys**, plus format, lint, strict types and a credential-free production build. Tasks 1–8 are independently reviewed. The clean Windows checkout uses the repository's explicit LF policy from `8a27c54`; its full gate is recorded in [STATUS](STATUS.md). Real GitHub OAuth, GitHub Actions and production deployment still require separate verification; there is no live URL. See [GATES](GATES.md) and the [original-prompt audit](docs/06-prompt-audit.md).

## Prerequisites

Use Node **24.22.1**, npm, Git, Bash and Docker with its Linux engine running. The verified workstation uses npm11.19.1 and Git2.52.0.windows.1. Exact application/tool packages are in the lockfile and [dependency record](docs/07-dependency-pins.md); no global Node change is required.

Browser tests use installed Microsoft Edge on Windows and Playwright Chromium on Linux. Windows/Edge is verified here; Linux CI execution remains pending. Supply the matching browser before running e2e. The ignored workstation runtime at `.tools/node-v24.22.1-win-x64` is not shipped with a checkout.

## First local setup

1. Install the pinned Node version and run `npm ci`.
2. Create the private env files below only if absent, selecting the appropriate groups from `.env.example`. Replace placeholders privately. URL-encode special characters in connection-string passwords.
3. Start the existing local databases and wait for health:

   ```sh
   docker compose up -d db
   docker compose --profile test up -d db-test
   docker compose ps
   ```

4. Apply reviewed development migrations with `npm run db:migrate`. The journal and dedicated session lock make an unchanged replay a no-op.
5. Optionally run `npm run db:seed -- --local-development`. It adds/verifies fictional users and history, refuses conflicting fixtures, and creates no sign-in identity.
6. Configure local GitHub OAuth, then run `npm run dev` and open [localhost:3000](http://localhost:3000).

| Private file | Values                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env`       | Compose only: distinct `LOCAL_DB_PASSWORD` for migrator and `LOCAL_RUNTIME_PASSWORD` for runtime. Initial passwords are shared by the two local containers.                                                                          |
| `.env.local` | `DATABASE_URL` as `habit_garden_runtime` and direct `MIGRATION_DATABASE_URL` as `habit_garden_migrator`, both targeting `habit_garden_dev` at127.0.0.1:55434. Add `AUTH_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. |
| `.env.test`  | `TEST_DATABASE_URL` as migrator and `TEST_RUNTIME_DATABASE_URL` as runtime, both targeting exactly `habit_garden_test` at127.0.0.1:55433. This database is disposable; the integration runner rebuilds its schema.                   |

Existing volumes retain their original PostgreSQL passwords. Editing env values does not rotate a database login. Normal setup preserves env files, development rows and volumes. On a later run, start the existing DB, apply only pending reviewed migrations, and start the app; seed replay is optional.

## Local GitHub sign-in

Register a local GitHub OAuth app with homepage `http://localhost:3000` and callback `http://localhost:3000/api/auth/callback/github`. Put its client ID/secret in ignored `.env.local`, set `AUTH_URL=http://localhost:3000`, and use a private random `AUTH_SECRET` of at least32 characters. Restart the server after changing configuration.

Complete a real provider round trip, explicitly confirm the IANA timezone, then sign out and verify the dashboard is protected again. The app requests profile scope only. Keep local and production OAuth apps separate. Follow the [GitHub registration instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) and [Auth.js callback guide](https://authjs.dev/guides/configuring-github). Seeded users and automated session fixtures cannot replace this provider check. Real local OAuth is still pending because credentials have not been configured.

## Run and verify

| Command                                                     | Behavior                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                               | Development server using private runtime configuration.                                                                              |
| `npm run build`                                             | Production build with DB/OAuth runtime values cleared in the child process, including env-file fallback prevention.                  |
| `npm start`                                                 | Serve the existing production build; runtime DB/OAuth configuration is required for sign-in and private pages.                       |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Separate formatting, lint and strict TypeScript checks.                                                                              |
| `npm run test:unit`                                         | Domain, validation, source-identity, readiness and gate behavior.                                                                    |
| `npm run test:integration`                                  | Guarded fresh-schema migrations and real PostgreSQL invariants/transactions in the exact disposable testDB.                          |
| `npm test`                                                  | Unit and real-DB suites.                                                                                                             |
| `npm run test:e2e`                                          | Three formal browser journeys against a built app and the migrated disposable testDB; it does not reset or migrate another database. |
| `bash check.sh`                                             | Fail-fast preflight, format →lint →typecheck →unit →guarded integration/migration →credential-free build →three browser journeys.    |

Run the complete gate from the repository root. It requires the exact Node version, installed dependencies/browser, working Git/Bash/Docker and private `.env.test`; missing or unsafe prerequisites fail. Only the existing integration runner rebuilds the explicitly named disposable testDB. Run `npm run test:integration` and `npm run build` before standalone e2e if those prerequisites are not already satisfied. The gate does not seed or reset the development database.

On the verified Windows workstation, Git for Windows Bash works while the default WSL Bash launcher is restricted. With pinned Node on PATH, use:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' check.sh
```

The gate prefers the reviewed `.tools` Windows runtime if present; other checkouts must supply Node24.22.1. Browser fixtures create ordinary Auth.js sessions only from guarded test-runner code. Application code has no fixture endpoint, login bypass or fake-clock setting. Auth-bearing traces, videos, screenshots and failure contexts are disabled for these journeys.

## Build identity and operational checks

`/api/status` returns no-store liveness, the baked full source SHA and a dirty-checkout flag. `/api/ready` performs only a bounded `SELECT 1`, returning ready200 or generic unavailable503. Neither endpoint requires OAuth or returns private rows/configuration.

Production builds require a verified checkout identity. A dirty local build reports that fact; request headers, query parameters and runtime metadata variables cannot replace the baked SHA. A trusted source export without `.git` must supply its corresponding full nonzero SHA through build-time `HABIT_GARDEN_BUILD_SOURCE_SHA`; a mismatch with an existing checkout is refused. Release verification must compare the tested artifact's exact SHA and reject dirty/unknown identity.

## Data and troubleshooting

All private operations derive ownership from an unexpired session and validate input. The server obtains the authoritative local date after acquiring the user lock. Same-habit/day retries retain one log/reward; stale-day requests refresh state and require another deliberate click. Archive keeps logs, streak history, plants and totals. Timezone is fixed after confirmation; undo, backfill, edit/reactivation, placement editors and reminders are outside P0.

- If the Docker pipe is absent or PostgreSQL refuses connections, verify the Linux engine and the project containers first. See [ERRORS](ERRORS.md) for diagnosed socket and sandbox failures; preserve existing data/volumes.
- The development port is55434 and the disposable test port is55433. The old55432 port conflicted; do not stop an unrelated listener to reclaim it.
- `EACCES`, Git Bash MSYS permission errors or Turbopack junction denial may be sandbox boundaries. The recorded checks passed on the permitted host; a failed/unrun command remains pending until actually verified.
- Seed refusal means target, flag or fixture conflicts need investigation. It never authorizes overwriting data. A login configuration error requires private OAuth settings, not a seeded login or bypass.

## CI/CD and remaining manual work

Phase2 is pending: no workflow, remote publication, production migration, cloud project or deployment has been verified. The approved design proposes a personal public repository, independently provisioned Neon Free and Vercel Hobby for personal/noncommercial use. Actual account permissions, current free/no-card terms, secrets and onboarding must be verified before provisioning. No card, paid plan, trial or Marketplace billing is authorized.

The next manual application check is local OAuth registration/configuration and the real sign-in/sign-out round trip. Later cloud work needs production OAuth and DB credentials, GitHub/Vercel secrets and actual exact-SHA pipeline/deployment evidence. Enter credentials privately; public source and logs must contain placeholders only. The historical audit has0 production and8 development-tool affected nodes; see the dated [dependency record](docs/07-dependency-pins.md), not a claim of a fresh audit.

## Project records

Start with [AGENTS](AGENTS.md) and [STATUS](STATUS.md) to resume. [PRD](PRD.md) owns P0/AC01–AC12; [data design](docs/01-data-design.md) owns exact rules; [architecture](docs/02-architecture.md), [FLOWS](FLOWS.md) and [handoff](FRONTEND_HANDOFF.md) define implementation boundaries. [Ordered tasks](docs/05-task-breakdown.md), [CI/CD design](docs/03-cicd-plan.md), [free-tier evidence](docs/04-free-tier-verification.md) and [GIT_FILE](GIT_FILE.md) retain decisions and command evidence. [CHANGELOG](CHANGELOG.md) records the unreleased local build.
