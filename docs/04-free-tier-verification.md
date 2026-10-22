# Phase 0 — Current free-tier verification

Verified on **2026-10-21, Asia/Kuala_Lumpur**, by inspecting the official public sources linked below. This is a terms/limits review, not a completed account signup, account audit, provisioned resource, running pipeline, or deployment. No card, trial, paid plan, Marketplace integration, or cloud resource has been added.

Resumption review on **2026-10-22, Asia/Kuala_Lumpur** rechecked the core Neon/Vercel/GitHub/Supabase quotas, GitHub protection/visibility restrictions, Docker pull limits, Vercel Marketplace terms, and automation bypass availability. The local Docker licensing/prerequisite review and historical signup-screen observation retain their original date. The Marketplace claim below is corrected; no account-level gate has been passed.

## Proposed route and approval conditions

Use local PostgreSQL through Docker Compose; a personal GitHub Free repository; Neon Free provisioned **directly on Neon's site**; and Vercel Hobby for a personal, noncommercial app on its default domain. TypeScript/PostgreSQL/Next.js require no paid license. No custom domain, paid email, image service, monitoring subscription, or commercial add-on is required.

Neon's public pricing explicitly states that its Free plan does not require a credit card. **Vercel standalone no-card project creation remains unverified**: the inspected official pricing/Hobby pages did not give an explicit no-card promise, and the signup screen alone cannot establish what later steps require. The strict no-card requirement is therefore not yet proven for the whole hosted route. A real account/project onboarding check is a pre-deployment gate. If it requires a card, stop that cloud path, retain the working local app, and revise the hosting decision with the user. Do not accept a trial, attach a payment method, or silently choose a paid alternative.

The proposed native GitHub production environment approval gate assumes a **public personal repository**. Publishing source requires explicit approval; this design does not make the repository public. A private-repository preference changes the available free native protection model and must be resolved before deployment design is implemented. Personal source publication never includes habit data, database exports, session state, logs containing private data, or secrets.

## Neon Free — preferred hosted PostgreSQL

| Verified limit/behavior                                                                                                                                 | Practical implication                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| No-card Free plan; no fixed trial expiration; up to 100 projects                                                                                        | Provision independently and keep one MVP project. These terms are not a promise that the service will never change.    |
| 100 CU-hours per project/month                                                                                                                          | Track compute usage; an always-busy app can exhaust the allowance.                                                     |
| **1 GB database storage per project**; 20 GB aggregate across Free projects                                                                             | This replaces older 0.5 GB advice. The small schema fits initially; logs still grow over time.                         |
| 5 GB public network transfer per project/month                                                                                                          | Bounded dashboard queries and no large exports.                                                                        |
| 10 branches per project; maximum 2 CU (approximately 8 GB RAM)                                                                                          | Branches are optional; no paid branch/test infrastructure is needed.                                                   |
| Forced scale-to-zero after 5 idle minutes                                                                                                               | Expect cold database startup and show retryable loading/error UI.                                                      |
| Compute/transfer quota exhaustion pauses availability until the next billing period                                                                     | Do not present a zero-cost app as having an uptime guarantee.                                                          |
| Storage overage blocks storage-changing operations; Free has a 6-hour recovery window with 1 GB change limit, one manual snapshot, no scheduled backups | Monitor usage and perform guarded manual exports before risky maintenance; this is limited recovery, not a backup SLA. |

Sources: [Neon pricing](https://neon.com/pricing), [current plans and limits](https://neon.com/docs/introduction/plans), and [official 2026-10-02 announcement of 1 GB per Free project](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Use Neon's pooled connection string for serverless runtime. The pooler supports up to 10,000 client connections, which does **not** mean 10,000 concurrent SQL queries. At 0.25 CU the published PostgreSQL connection count is 104, with 7 reserved and 97 available to application users. Use a small application pool and direct credentials for migration/advisory-lock/export sessions. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## Supabase Free — documented alternative, not selected

Free includes two active projects, a 500 MB PostgreSQL database per project, shared compute with up to 0.5 GB RAM, 5 GB monthly egress plus 5 GB cached egress, 1 GB file storage, and 50,000 monthly active users. API request count is unmetered on the published plan, but compute/size/transfer limits still apply. [Supabase pricing](https://supabase.com/pricing).

Published Nano connection limits are 60 direct connections and 200 pooler clients. Low database activity over a seven-day period can trigger automatic pausing; occasional use does not guarantee exemption. Current documentation gives up to one year after pausing to resume from the dashboard; older 90-day guidance is not used here. [Compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk), [Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

A 2026-07-23 official Supabase article describes its Free observability setup as requiring no card on either side. This is public no-card evidence, not a completed fresh-account/project creation test. [Official Supabase/Grafana announcement](https://supabase.com/blog/observability-for-every-supabase-project-with-grafana-cloud).

Neon is preferred because this app needs ordinary PostgreSQL, not Supabase auth/storage/realtime, and the verified per-project database allowance is larger. Switching is a design change, not an automatic fallback hidden in the deploy job.

## Vercel Hobby — conditional hosting proposal

Hobby is free for **personal, noncommercial use**. Revenue, advertising, or paid client site work changes eligibility; such use is outside this MVP and cannot be moved to a paid plan under the user's zero-cost rule. Monthly relevant published allowances are 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1 million CDN requests, 1 million function invocations, 4 CPU-hours, and 360 GB-hours provisioned memory. Over-limit Hobby resources generally require waiting for the relevant recovery window rather than purchasing use. [Vercel Hobby](https://vercel.com/docs/plans/hobby), [fair-use terms](https://vercel.com/docs/limits/fair-use-guidelines).

Current limits list one concurrent deployment, 100 builds/hour, 100 deployments/day, a 45-minute build ceiling, and a 100 MB CLI source upload limit. Hobby cannot connect a Git repository owned by a Git organization; a personal repository avoids this restriction. An older search snapshot listed 32 builds/hour and 6,000 monthly build minutes. The current live limits page gives 100 builds/hour, while current pricing labels Basic build minutes as included without confirming a numeric monthly allowance. **Do not treat 6,000 minutes as currently verified.** [Vercel limits](https://vercel.com/docs/limits), [current pricing](https://vercel.com/pricing).

Fluid Compute is the current new-project default. The published Hobby function envelope is 2 GB/1 vCPU and default/maximum duration 300 seconds, with autoscaling concurrency up to 30,000; these upper envelopes do not bypass monthly quotas or PostgreSQL capacity. Our app must use short requests and bounded DB pools. [Function limits](https://vercel.com/docs/functions/limitations).

Correction verified on 2026-10-22: the Marketplace terms describe both free and paid third-party apps; the payment-method requirement in section 3.1 specifically applies to Enterprise customers. This source does not establish a blanket card requirement for Hobby. The project still proposes independently provisioned Neon Free, whose no-card terms are explicit, and excludes Marketplace integrations to avoid a separate unverified billing flow. [Marketplace service terms, effective 2026-06-01](https://vercel.com/legal/integrations-marketplace-service-terms).

Protection Bypass for Automation is documented as available on all plans. The existing staged-smoke plan can use a project automation secret in the `x-vercel-protection-bypass` HTTP header. Actual project permissions, secret configuration, and smoke access remain unverified; the token does not replace application authentication. [Vercel automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

The public [Vercel signup screen](https://vercel.com/signup) offered OAuth/email entry without card fields when inspected. That does not verify subsequent project creation or anti-abuse checks. The standalone no-card gate remains open. There is no verified deployed URL at this stage.

## GitHub Free and Actions

GitHub Free supports personal public and private repositories, with feature differences. Standard hosted runner compute is free for public repositories. A Free private repository receives 2,000 minutes/month and 500 MB artifact storage; cache capacity is 10 GB per repository. Artifact storage can be shared with other billed products, so keep retention short and avoid DB dumps or browser session files. With no valid payment method, excess usage is blocked rather than silently becoming a permitted paid dependency. Larger runners require a payment method and are excluded. [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Free standard job concurrency is 20, including at most five macOS jobs, and a hosted job has a six-hour limit. The planned Linux/PostgreSQL/Chromium pipeline is sequential where useful and needs no macOS or paid runner. [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits).

On GitHub Free, native environment secrets/variables, deployment branch rules, and protection capabilities depend on a public repository. Required-reviewer availability also varies by plan/visibility; do not claim the same production gate on a Free private repository. The proposed public-repository production environment can require a reviewer, but a one-maintainer project allowing self-review does not provide independent approval. [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).

## Local runtime and Docker

Docker Personal/Desktop is free for personal use, and Docker Desktop can be used without signing in. Local PostgreSQL therefore needs no hosted DB account/card; the user's machine supplies CPU, memory, storage, and connectivity. The documented Windows requirements include WSL 2.1.5 or newer, hardware virtualization, and 8 GB RAM; the machine's compliance has not been verified. [Docker Personal](https://www.docker.com/products/personal/), [Desktop account behavior](https://www.docker.com/blog/maximizing-docker-desktop/), [Windows prerequisites](https://docs.docker.com/desktop/setup/install/windows-install/).

Docker Hub currently allows 100 pulls per six hours for anonymous users per IPv4 address or IPv6 /64 subnet; a signed-in Personal account receives 200. Pin one official PostgreSQL image by supported version/digest and reuse it locally/CI. [Docker Hub pull limits](https://docs.docker.com/docker-hub/usage/pulls/).

The existing Docker CLI is installed but its engine probe failed; default Bash and Git repository probes also failed. Node is present but differs from the proposed LTS baseline. These local readiness issues are recorded in `../ERRORS.md`; public service eligibility does not resolve them.

## Gates before cloud deployment

1. User approves personal/noncommercial use, proposed dependency/service choices, immutable timezone/threshold rules, and whether source may be public. No source is published during Phase 0.
2. Confirm real GitHub/Neon/Vercel account ownership and current free plans. Do not attach a card or start a Pro trial. Check existing account payment settings without exposing them in logs.
3. Complete standalone Neon/Vercel project creation without a card. Record actual results, region choices, account quotas, and any anti-abuse eligibility restrictions. Stop if the strict no-card constraint cannot be met.
4. Confirm personal repository ownership and the exact free branch/environment controls. If private visibility is required, revise the protection design before implementation.
5. Configure default-domain OAuth callbacks and scoped secrets; verify no Marketplace billing was introduced. Inspect account dashboards for usage and cold-start behavior.
6. Run migrations, full CI, staged smoke, same-deployment promotion, and canonical smoke; record exact SHA and URL. Document manual export/recovery procedure and capacity monitoring.

At present all account-level and deployment gates are pending. The product is planned, not built or deployed. Service terms must be rechecked before provisioning because the verification date is not a future price guarantee.
