# Phase 0.4 — CI/CD and release design

Status: approved design; task10 quality workflow implemented on 2026-10-23, hosted verification pending. Original design date: 2026-10-21, Asia/Kuala_Lumpur. Production configuration and deployment remain pending.

## Implementation checkpoint — 2026-10-23

`.github/workflows/ci.yml` runs the existing `bash check.sh` on Ubuntu24.04 for every PR and main push. It uses checkout7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), setup-node7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`), Node24.22.1, and the Compose PostgreSQL digest. The official action tags and setup-node inputs were checked during implementation. Both actions run with read-only repository permissions; checkout credentials and dependency caching are disabled.

Only the ephemeral `habit_garden_test` service is initialized. The existing test runner owns reset, migration/no-op verification and runtime-role tests. Build and e2e keep their existing credential and target guards. The workflow also checks the artifact's baked SHA and clean source against the event SHA (the synthetic merge commit for a PR).

Test output stays in job logs and a compact workflow summary; no artifact upload is configured. This deliberately avoids publishing browser cookies/state/traces or SQL/env files. The job has a20-minute deadline. Task12 will add the trusted production handoff after actual quality/account gates pass. The public personal repository `tbk0809/habit-garden` was found empty with admin/push permission; publication and actual run URLs are recorded separately when verified.

## Preconditions and free-plan boundary

The plan assumes an approved **public personal GitHub Free repository**, a personal/noncommercial Vercel Hobby project, and an independently created Neon Free database. Public source is a proposed requirement for the selected free native branch/environment protection model; it is not permission to publish. A private-repository decision requires revising protections before deployment. Never place personal habit data, DB exports, credentials, cookies, or browser storage state in Git or public artifacts.

Actual Vercel standalone no-card onboarding remains unverified. If any service requires a card, a trial, or payment, stop provisioning and return to a compatible free design. No Marketplace database integration. Full current evidence, quota limits, and risks are in `04-free-tier-verification.md`.

## Required workflow shape

| File/job                                                 | Trigger and responsibility                                                                                                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` — quality                     | Every pull request and every push to `main`; check out the exact event SHA and run all application gates against ephemeral PostgreSQL. Main is tested again; a PR success alone is insufficient.                                              |
| `.github/workflows/ci.yml` — production handoff          | Only after quality succeeds on a trusted same-repository `push` to `refs/heads/main`; call the local reusable deploy workflow with the exact tested SHA.                                                                                      |
| `.github/workflows/deploy.yml` — reusable production job | Callable only by the trusted main CI path; protected `production` environment; validate source/caller/check results; run one serialized migration→stage→smoke→promote→smoke release. No untrusted PR caller or production secrets in PR jobs. |

Avoid privileged `pull_request_target` execution, privileged `workflow_run` checkout of untrusted artifacts, arbitrary branch deploy inputs, or building a PR with production credentials. Deployment code must come from the tested trusted main commit. A manual retry reruns the trusted main workflow, repeats checks and stale-main validation, and still passes the production environment gate.

Use minimal workflow permissions: `contents: read` for checks; explicitly scoped read permissions for verification of check/run metadata; deployment write permissions only if required for GitHub deployment records. Pin third-party and official actions to reviewed full commit SHAs, pin runtime/CLI versions, and commit a lockfile. Configure automated update PRs later only if needed; do not install an extra service in MVP.

## CI gates and test environment

Use a standard Ubuntu GitHub-hosted runner and a PostgreSQL service container pinned to the same supported major/image digest as local Compose. Service health checks must pass before migrations. Its credentials are disposable workflow constants, not production secrets. Use a test-specific DB name and loopback-only URLs; fail if tests or reset helpers see a hosted/production target.

Ordered quality gates:

1. Check out exact event SHA; install pinned Node 24 LTS patch and lockfile dependencies using `npm ci`.
2. Check formatting (`npm run format:check`), lint (`npm run lint`), and TypeScript (`npm run typecheck`). Run ESLint explicitly rather than relying on `next build` to lint.
3. Run pure unit tests (`npm run test:unit`).
4. Apply committed migrations to a new test database, then run DB integration tests (`npm run test:integration`). Verify a repeat migration run is a no-op and test runtime-role permissions. Catalog migration is allowed; production-style seed is not needed for tests.
5. Build (`npm run build`) with database networking and OAuth/runtime secrets absent from the build process. This proves lazy server configuration and request-time private data access. The test server receives separate runtime env afterward.
6. Install the pinned Playwright Chromium runtime and run the three core e2e journeys against that built local server with its dedicated ephemeral test database (`npm run test:e2e`). The test runner creates normal Auth.js database sessions directly and sets real session cookies; no app auth-bypass endpoint exists.
7. Upload compact test summaries with short retention. Playwright traces, auth state, and network captures are not uploaded by default because they may contain session cookies. Keep local traces ignored; only explicitly scrubbed screenshots of fictional test data may be published. Exclude `.env`, storage state, SQL dumps, tokens/cookies, and personal data. Publish the exact SHA and gate conclusions in the workflow summary.

One quality result must require all gates. Set bounded job/test timeouts and close DB pools/browser processes. Production secrets are not made available for these checks. Branch protection requires this quality result before merge. A fresh main run repeats the checks before production deployment.

`bash check.sh` will be the local aggregate gate for the same format/lint/type/unit/integration/build/e2e checks against a verified test database. It must fail on any subcommand failure, missing prerequisites, or unsafe DB target. It must not start a destructive reset, seed production, or migrate production. The script does not exist in Phase 0, and no claim of passing it is made.

## Secrets and role separation

| Location                                  | Proposed values                                                                                                                 | Boundary                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed `.env.example`                  | Placeholder local DB URL, test DB URL, OAuth client IDs/secrets, Auth.js secret, app URL; documented required/optional fields   | No real password/token/endpoint with credentials. Dev-only sample DB credential is labeled local/disposable and is never reused in cloud.                                                     |
| Local ignored `.env.local`                | Local runtime DB URL, local OAuth app credentials and local Auth.js secret                                                      | Created by the user; never logged, uploaded, or committed.                                                                                                                                    |
| Vercel production environment             | Pooled least-privilege runtime DB URL; production GitHub OAuth credentials; Auth.js secret; canonical app URL                   | Runtime only; no migration-owner credentials, seeds, reset flags, test sessions, or provider repository scopes.                                                                               |
| GitHub protected `production` environment | Vercel token/project/team IDs; direct Neon migration URL; project automation bypass secret if deployment protection requires it | Available only after environment approval in trusted deployment job. Use a dedicated migration role and short-lived/scoped credentials where the service supports them without paid features. |
| CI quality job                            | Ephemeral PostgreSQL credentials; generated temporary test session secret; test-only loopback app URL                           | No production identity/service secrets or paid infrastructure.                                                                                                                                |

Use GitHub's secret masking but do not rely on it to sanitize SQL/tool errors; redact connection URLs and tokens explicitly. Never echo env files or pass secrets to URL query parameters, cache keys, artifact names, or PR comments. Do not add an integration requiring a payment method or paid deployment-protection bypass.

## Exact-source release protocol

Disable Vercel's independent Git deployment trigger with the current `git.deploymentEnabled: false` project configuration. The older `github.enabled` setting is deprecated. The GitHub deployment workflow owns promotion, avoiding a second unreviewed path racing ahead of migrations.

One `production` concurrency group covers migration, staging, smoke, and promotion with **cancel-in-progress: false**. Never cancel a migration midway. A superseded queued run exits before modifying production. GitHub queuing may replace a pending run; correctness must depend on the stale-main checks, not assumed FIFO order.

1. After quality passes, enter the protected production environment. The user may be the sole maintainer; allowing self-review is an explicit small-project compromise and cannot be called independent approval. If multiple maintainers exist, prefer a separate reviewer.
2. Verify the event is a trusted same-repo main push, inspect the successful quality job for this exact SHA/run, check out that SHA, and assert `HEAD` equality. Fetch the current remote main tip. If it differs, exit as superseded before migration. A check against another SHA, PR merge ref, or old deployment is insufficient.
3. Install exact reviewed dependencies/CLI and validate service/project identity. Do not create a new paid resource or alter account billing from a job.
4. Acquire a PostgreSQL advisory lock on a **dedicated direct `pg.Client` session** and run pending committed additive migrations with a journal. Keep the lock for the runner's full sequence and release/close in a finally path. A session lock cannot be split across pooled connections. Existing deployed code must remain compatible with the new schema.
5. Pull Vercel production configuration using the pinned CLI (`vercel pull --environment=production`), build with production configuration (`vercel build --prod`), then create a staged **production** deployment without assigning the canonical domain (`vercel deploy --prebuilt --prod --skip-domain`). Capture deployment ID and URL; do not infer success from upload completion.
6. Wait within bounded time for Vercel READY. Run read-only smoke checks against the staged deployment: public page/status, exact baked source SHA, runtime readiness and a minimal DB read, and an unauthenticated protected-page redirect. Health responses expose no secrets, table data, or private user details. A readiness check must not create fixtures or mutate production. If deployment protection blocks the URL, use the project automation secret through the `x-vercel-protection-bypass` HTTP header. [Automation bypass is available on all plans](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), verified 2026-10-22; actual permissions/configuration/access still require verification before promotion. Keep the secret in the protected deployment job, never a URL or quality/PR job. Application auth checks still apply.
7. Recheck remote main equals the tested SHA immediately before promotion. If superseded, leave the additive schema in place, retain evidence, and do not promote the old app.
8. Promote the **same staged production deployment** by its captured ID/URL. Do not promote a preview build that would be rebuilt with different production settings, and do not rebuild after smoke.
9. Check the canonical URL now resolves to that deployment and source SHA; repeat read-only smoke. Record a successful release only after this passes. Perform real GitHub OAuth and a deliberate user-owned first completion manually as a separate acceptance check, with no production test fixture/reset.

The build must not require a DB or runtime secret to execute, even though the production CLI can download runtime config. Keep downloaded secret files ephemeral and out of artifacts. The deployment artifact's source SHA must be baked at build time from the verified checkout; a response cannot merely echo an untrusted request input.

## Migration, failure, and recovery policy

- Migration failure blocks staging/promotion and leaves the previously deployed application serving. Report the failing migration ID with credentials removed. No automatic retry of unknown partial/destructive SQL; inspect the journal and actual DB state.
- Staging/smoke failure blocks promotion. Additive schema changes remain forward; fix the app/migration through a new reviewed commit.
- If main changes after migration, the old run does not promote. The newest tested commit handles the resulting compatible schema.
- Post-promotion canonical failure requires explicit diagnosis and, when safe, restoring the previous known compatible deployment; it never drops tables or rolls back schema automatically. Record both failed and recovery deployment IDs. Do not call the release successful merely because a promotion command returned zero.
- Production seed/reset/e2e session fixtures/destructive migrations are forbidden. Manual snapshot/export and recovery instructions must be documented before any future risky data change. Free recovery limits are not an excuse to delete user data.

## Release evidence

Record a redacted release manifest containing source SHA, CI run ID/attempt and URL, dependency/CLI versions, migration IDs applied/current journal version, staged deployment ID/URL, readiness and smoke conclusions, promoted canonical URL, time, and any recovery action. Use the workflow summary and a small artifact with short retention. Append the confirmed result to `GIT_FILE.md`/`CHANGELOG.md` in a later normal documentation commit; the deployment job must not automatically commit back to main and trigger itself recursively.

## Manual actions that automation cannot assume

The user creates or selects GitHub/Neon/Vercel free accounts; confirms no-card project creation and noncommercial eligibility; authorizes personal repository visibility/publication; supplies repository identity and OAuth/deploy secrets; configures OAuth callback URLs; enables actual branch/environment protections; and approves the production environment if configured. The agent may prepare exact instructions after approval, but Phase 0 does not claim these exist or send messages to anyone.

## Official references inspected

- [PostgreSQL service containers in Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [secure Actions use](https://docs.github.com/en/actions/reference/security/secure-use), [deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), and [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).
- [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration), [CLI deployment](https://vercel.com/docs/cli/deploying-from-cli), and [promotion behavior](https://vercel.com/docs/deployments/promoting-a-deployment).
- [Neon pooled/direct connection behavior](https://neon.com/docs/connect/connection-pooling).

Workflow syntax, action SHA pins, CLI options, effective account protections, and live smoke access must be verified during implementation. This document is a release design, not a passing pipeline or a deployment report.
