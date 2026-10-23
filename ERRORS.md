# Environment and execution issues

## 2026-10-21 — Git cannot inspect the workspace

- Commands: `git status --short`, `git rev-parse --show-toplevel`, and explicit `git -C "C:/Users/Asus/Documents/Habit Garden" status --short`.
- Result: `fatal: cannot change to 'C:/Users/Asus'` with both installed and bundled Git. `git --version` succeeds: 2.52.0.windows.1.
- Impact: repository identity, history, commits, and remote are unverified. No `.git` entry was visible in the workspace listing. No commit or push was attempted.
- Follow-up: recheck Git access before Phase 1; if no repository exists, initialize it in this directory as an explicit logged build step. Do not alter global Git settings or another repository to work around this.

## 2026-10-21 — Local Docker engine unavailable

- Command: `docker info --format '{{.ServerVersion}}'`.
- Result: cannot connect to `dockerDesktopLinuxEngine`; named pipe not found. Docker CLI 29.1.2 is installed.
- Impact: a local PostgreSQL container and integration tests cannot currently be verified.
- Follow-up: start/configure a free eligible local engine before Phase 1 DB verification. Do not report local DB tests passing until they actually run.

## 2026-10-21 — Default Bash unavailable

- Command: `bash --version`.
- Result: `Bash/E_ACCESSDENIED` from the Windows WSL launcher.
- Impact: the required `bash check.sh` gate cannot run through this launcher; `check.sh` also does not exist in Phase 0.
- Follow-up: verify Git for Windows Bash or a working WSL Bash during Phase 1. CI will use Ubuntu Bash. No check was passed or waived.

## 2026-10-21 — Local Node version differs from proposed LTS

- Observed: Node v25.2.1, npm 11.6.2.
- Impact: these commands establish executable availability only, not application compatibility. The design proposes Node 24 LTS; pin and verify a supported patch before installing dependencies in Phase 1.

## 2026-10-21 — Native Git Bash also unavailable in the sandbox

- Command: `C:\Program Files\Git\bin\bash.exe --version`.
- Result: `NtCreateDirectoryObject` for an MSYS BaseNamedObjects path failed with `0xC0000022`.
- Impact: an alternative Bash executable was found, but it is not verified working here. The aggregate app gate remains unrun.
- Follow-up: verify a permitted working Bash environment before Phase 1 gate execution; Ubuntu CI is the planned independent environment. Do not claim this probe passed.

## 2026-10-22 — Resumption prerequisite recheck

- Read-only probes were repeated in the exact Habit Garden workspace; no tool installation, global configuration change, Docker startup, or quota-resume work was performed.
- `git --version` still returns `2.52.0.windows.1`; `git status --short` and `git rev-parse --show-toplevel` still fail with `fatal: cannot change to 'C:/Users/Asus'`. The workspace listing contains no visible `.git` entry, so repository identity/history remain unverified.
- `docker info --format '{{.ServerVersion}}'` still cannot find the `dockerDesktopLinuxEngine` named pipe. Local PostgreSQL and DB integration checks remain unrun.
- Native Git Bash still fails with `NtCreateDirectoryObject` / `0xC0000022`; default Bash still returns `Bash/E_ACCESSDENIED`. Neither is a verified execution environment for `bash check.sh`.
- Node `v25.2.1` and npm `11.6.2` are unchanged; the proposed Node 24 LTS baseline remains uninstalled/unverified.
- Impact/follow-up: these are current build prerequisites to resolve after approval. No application or acceptance result is inferred from these probes. The known failures remain open; historical entries above are preserved.

## 2026-10-22 — Host boundary and Docker startup diagnosis

- Outside the sandbox, Git Bash 5.2.37 works. Git had resolved an unrelated ancestor repository at the user's home; a new repository was initialized only in Habit Garden on `codex/habit-garden`. The ancestor was not modified. The old sandbox failures are not evidence of a broken host Git/Bash installation.
- Official Node 24.22.1 LTS was downloaded, SHA256 checked, and extracted into ignored project-local `.tools`; system Node/PATH were not changed. Exact package freeze is recorded in `docs/07-dependency-pins.md`.
- Docker Desktop 4.54.0 and WSL2 were already installed but stopped. `docker desktop start --detach` returned 0 while its backend subsequently crashed removing the stale `Docker/run/dockerInference` socket. A preserved runtime-directory rename let startup proceed to the same error on `docker-secrets-engine/engine.sock`.
- Both runtime directories contain only zero-byte socket/reparse files. With Docker stopped and exact source/backup paths checked, both were renamed to sibling `*.habit-garden-backup-20261022-2032` directories. The earlier `Docker/run.habit-garden-backup-20261022-1745` backup also remains. No file was deleted and no image/volume/WSL disk/database was moved or reset.
- Docker's issue tracker contains a matching report and reversible parent-directory workaround: [issue 460](https://github.com/docker/desktop-feedback/issues/460). Matching symptoms support this targeted attempt; actual engine success still requires a fresh probe.

## 2026-10-22 — Verified resolutions and nonblocking build issues

- **Docker startup resolved:** after both preserved runtime-socket directory moves, the fresh engine probe returned `29.1.2 linux`. Project-specific development and test PostgreSQL containers were subsequently observed healthy. All old runtime backups remain; no factory reset or database/volume deletion occurred.
- **Local dev port conflict resolved:** the initial development port `55432` was occupied. The worker checked and used free loopback port `55434`; the separate test container uses `55433`. Current project Compose status confirms both mappings. No unrelated listener/container was stopped or changed.
- **Document update context corrected:** a progress patch expected unpadded Markdown table rows after Prettier had aligned their cells. It failed verification without partial file edits. The coordinator updated the cell values, reran Prettier, and preserved append-only log history; no application code or behavior changed.
- **Dependency install recovered:** the initial sandbox npm attempt stalled; an escalated public-registry attempt encountered `ECONNRESET`, then a bounded cached retry and clean `npm ci` succeeded. Exact pins/peer rules were preserved. Current known development-tool audit findings are recorded in `docs/07-dependency-pins.md`, not treated as a clean full audit.

## 2026-10-23 — Resume verification environment failures

- Fresh sandbox tests:151 unit cases passed; test-DB connection returned EACCES. Host probe returned ECONNREFUSED and Docker's Linux engine pipe was absent, establishing that the service was also stopped.
- `docker desktop start --detach` returned0, but host backend log at04:33:49 UTC confirms the same stale Docker/run/dockerInference socket startup crash recorded on2026-10-22. Recovery is limited to stopping the failed startup and preserving checked runtime directories as sibling backups; database volumes/images/WSL disks are outside that operation.
- Sandbox Turbopack build failed creating a pg junction with Windows access denied. The exact empty-runtime-env build passed on the host; no package/config workaround was introduced.
- Full integration/browser evidence is pending until the local engine is restored. These failures are not passing acceptance and are not evidence of an application transaction defect.

## 2026-10-23 — Clean Windows checkout fails formatting because EOL was unspecified

- A new clean local clone at440dcdf installed214 packages from lockfile/cache, then actual `bash check.sh` failed at format:check with106 tracked-file warnings. No later DB reset/test/build ran.
- Read-only diagnosis: system Git has core.autocrlf=true. The committed .prettierrc.json blob is50bytes/4LF/0CRLF; the clean worktree is54bytes/4LF/4CRLF. Existing `* text=auto` left eol unspecified for ordinary source/config, while Prettier expects LF. The dedicated shell rule already produced LF.
- Scoped fix: set the existing broad rule to `* text=auto eol=lf`, preserving shell/YAML/SQL rules. Do not change global Git configuration, format the failed clone, or treat a clean Git status as formatting evidence.
- Follow-up: preserve failed clone, commit the policy fix after applicable checks, create a new clean clone of that SHA and rerun installation/full gate. Task9 remains in progress until actual GREEN.

## 2026-10-23 — Repeated runtime socket failure on afternoon resume

Host startup at09:34UTC reproduced dockerInference stale-socket failure. Stopped Docker, verified exact runtime paths contain only socket reparse entries, and preserved Docker/run plus docker-secrets-engine as sibling .habit-garden-backup-20261023-1740 directories. Existing backups, database volumes and images remain. Restart is being checked; this is not yet acceptance evidence.

## 2026-10-23 — Documentation checkpoint sandbox test restrictions

The unchanged173-case unit suite returned164pass/9fail in the sandbox: temporary Git config writes and junction creation were denied, and loopback readiness fixtures could not complete. The same suite passed173/173 on the host at17:42MYT. Format,lint,typecheck and diff checks passed; no test or application workaround was introduced.
