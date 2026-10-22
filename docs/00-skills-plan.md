# Phase 0.1 — Skills and tools plan

Date: 2026-10-21, Asia/Kuala_Lumpur. Status: design proposal; no application code, dependencies, services, or workflows created.

## Instructions and authorization

The latest Habit Garden brief defines the product and explicitly authorizes Phase 0 design. It replaces the older executive-assistant project description in the supplied AGENTS status. Next.js, TypeScript, and PostgreSQL are user requirements. Every additional library/service below is a proposal for approval together with Phase 0. No installation or core-stack change has been made.

The user requests all six design documents now and a single approval stop afterward. This takes precedence over skill defaults that request extra intermediate approvals, different document paths, or application/test implementation snippets in a plan. The implementation checklist describes future work; it does not execute it.

## Skills inspected and applied

Paths below refer to the installed skills, not invented capabilities.

| Skill                          | Installed source                                                                                          | Use in this phase                                                               | Reason                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| using-superpowers              | `C:/Users/Asus/.codex/skills/using-superpowers/SKILL.md` and its Codex tools reference                    | Skill discovery and instruction precedence                                      | Establish a design-first workflow using the tools actually exposed here.                                                                                                                                             |
| brainstorming                  | `C:/Users/Asus/.codex/skills/brainstorming/SKILL.md`                                                      | Architectural classification, MVP, alternatives, approval gate                  | This is a new application, so interfaces and observable acceptance need design before implementation.                                                                                                                |
| writing-plans                  | `C:/Users/Asus/.codex/skills/writing-plans/SKILL.md`                                                      | Ordered checklist in `05-task-breakdown.md`                                     | Make tasks, files, dependencies, checks, and commit boundaries explicit.                                                                                                                                             |
| dispatching-parallel-agents    | `C:/Users/Asus/.codex/skills/dispatching-parallel-agents/SKILL.md`                                        | Independent read-only data, architecture/release, and pricing reviews           | Improve coverage without concurrent edits or service mutations.                                                                                                                                                      |
| fullstack-dev                  | `C:/Users/Asus/.codex/skills/fullstack-dev/SKILL.md`                                                      | Layer boundaries, configuration, authorization, transactions, errors            | Adapt its guidance to one Next.js monolith; no separate backend, refresh-token system, or microservices. Its database-schema reference informs modeling.                                                             |
| vercel:deployments-cicd        | `C:/Users/Asus/.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/deployments-cicd/SKILL.md` | CI/CD planning, staged production deployment, secret scoping                    | Avoid deploy/migration races and promote the tested production build. Current official docs take precedence over stale skill examples.                                                                               |
| verification-before-completion | `C:/Users/Asus/.codex/skills/verification-before-completion/SKILL.md`                                     | Check files, sources, coverage, and report unrun checks honestly                | A design review is not evidence that an application works.                                                                                                                                                           |
| codex-quota-resume             | `C:/Users/Asus/.codex/skills/codex-quota-resume/SKILL.md`                                                 | Separate explicitly requested local automatic-resume compatibility/install task | This is an environment tool, not an application dependency. The user subsequently returned to the app design task; monitor verification remained incomplete and no further quota troubleshooting belongs to Phase 0. |

## Coverage by engineering task

| Task          | Method                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data modeling | fullstack-dev database guidance + explicit PostgreSQL constraints + independent schema/domain review. No specialized habit-tracking skill exists in the available catalog; domain rules use documented engineering judgment.                     |
| Architecture  | brainstorming + fullstack-dev + official Next.js/Auth.js/Drizzle documentation.                                                                                                                                                                  |
| Testing       | verification-before-completion for evidence and own best-practice test pyramid. `test-driven-development` and `systematic-debugging` are available candidates for Phase 1 and must be read when used; they have not been claimed as applied now. |
| CI/CD         | vercel:deployments-cicd + official GitHub Actions/Vercel docs. No generic GitHub Actions-specific installed skill is claimed.                                                                                                                    |
| UI            | Accessible native HTML + authored SVG/CSS design in the architecture document. No image generation, design dependency, or hosted asset service is needed.                                                                                        |

## Tools available and inspected

- PowerShell file/command tools, `rg`, Git, Node/npm, Docker CLI, web research, and collaboration agents are exposed. Tool availability is not proof of authenticated service access.
- Vercel inspection/deployment and GitHub check tools are exposed, but no team/project/account identity was selected or mutated. Deployment is outside Phase 0.
- Official-source web browsing is used for free tiers and changing technical facts. Findings and direct URLs are in `04-free-tier-verification.md`.
- No missing plugin needs installation for Phase 0. No external message was sent.

## Environment observations

The initial directory listing contained only the newly created `GIT_FILE.md`. No prior project files, PRD, status file, source tree, package manifest, or visible `.git` were found. Git inspection failed with a home-path error, so the repository is not asserted to be initialized or clean. Node v25.2.1/npm 11.6.2 and Docker CLI 29.1.2 are present; Docker's engine and the default Bash launcher failed their probes. Details and follow-ups are in `../ERRORS.md`.

No application lint, typecheck, tests, build, `bash check.sh`, migrations, CI, OAuth login, or deployment has run. Phase 0 checks only establish document presence, link consistency, and design coverage. Every build/release success criterion remains pending.

## Resumption audit — 2026-10-22

The current session read Sepia and its professional/style/Chinese references for user-facing project prose, using-superpowers and its Codex reference for tool/instruction precedence, and verification-before-completion for fresh evidence. The parallel-review skill was also read for the independent product/data, architecture/task, and free-service reviews. These reviews were read-only; the coordinating session made the document corrections. No implementation skill, dependency installation, or service mutation is implied. Vercel documentation tooling was unavailable during the service review; official public web sources were used instead. The stopped quota-resume work was not resumed.
