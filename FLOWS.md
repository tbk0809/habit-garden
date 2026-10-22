# Habit Garden — approved interaction flows

Date: 2026-10-22, Asia/Kuala_Lumpur. Phase 0/P0/AC01–AC12 and coding are approved. This is an interaction specification; no page or action is claimed implemented. Rules come from [PRD](PRD.md), [data design](docs/01-data-design.md), and [architecture](docs/02-architecture.md). Wire contracts are in [FRONTEND_HANDOFF](FRONTEND_HANDOFF.md).

## Pages and entry states

| Route/state | Trigger and visible result |
|---|---|
| `/` signed out | Explain habit completion/garden growth and offer “Continue with GitHub”. No private data. Signed-in visitors proceed to onboarding or dashboard according to server state. |
| `/onboarding` | An authenticated user without confirmed timezone sees a labeled IANA timezone input, optional browser suggestion, and an explicit confirmation that timezone cannot change in P0. |
| `/dashboard` | Require a valid session and initialized user. Show authoritative local date/timezone, create form, active habits with current/best streaks and today's status, lifetime total, and four garden slots. |
| `/api/auth/[...nextauth]` | Auth.js owns OAuth callback/session/sign-out behavior and security checks. |
| `/api/status`, `/api/ready` | Minimal read-only operational responses for exact-source release checks. No user data or mutation. |

Protected requests with no/expired session return to the sign-in entry. Authenticated uninitialized users go to onboarding. Missing runtime configuration displays a safe unavailable state with retry; it never chooses test authentication. No preview-login, history, settings, placement, or account-management page is introduced.

## Sign-in, first-run timezone, and sign-out

1. “Continue with GitHub” starts the configured provider flow with minimal scopes. Provider cancellation/failure returns a safe sign-in error and retry without claiming success.
2. Auth.js persists the provider account and database session. The server resolves the user ID from the session callback, then routes by initialized state.
3. A new user edits/confirms the suggested IANA zone. Show validation inline and preserve the typed value after rejection. Browser detection never commits the timezone.
4. Submit disables that control and announces progress. The server validates application and DB zone recognition, locks the user, and atomically creates timezone/initialized state, count-zero garden, and clover.
5. Success or same-zone replay navigates to dashboard. A conflicting confirmed zone returns `TIME_ZONE_FIXED`; reload existing server state. An initialized user missing their garden receives an unavailable error; no hidden reset.
6. Sign-out uses Auth.js revocation. Clear private view/navigation state and return to sign-in only after successful revocation; failure remains visible. Refreshing a protected page after sign-out cannot expose private data.

## Create a daily habit

1. Enter a title in the labeled create form; submit the trimmed 1–80-character value. Boundary/server validation remains authoritative.
2. While pending, preserve the current list and input and disable that submit control. Do not insert a provisional habit or award points.
3. Under the common user lock the service checks the active count, then creates the habit and zero streak row together.
4. Success replaces the active list with the authoritative projection, clears the title, announces creation, and keeps focus predictable. Empty state becomes the normal list.
5. `VALIDATION_ERROR` associates field feedback with the title. `LIMIT_REACHED` explains the ten-active limit and preserves the title; archiving an existing habit frees capacity. Service failure retains input and offers retry.

## Complete a habit

1. Each active uncompleted row has a semantic completion button. Its command contains only `habitId` and the dashboard's server-issued `expectedLocalDate`.
2. Pending disables the initiating control, retains current text/SVG, and announces progress. No optimistic checkmark, streak increment, unlock, or growth animation.
3. The transaction uses user lock → owned habit → separate post-lock DB clock → authoritative civil date → expected-date guard → existing-log check → archive check → log/streak/total/unlocks → commit.
4. A new completion returns `completed`; render its coherent projection and announce habit completed plus resulting garden text. A duplicate returns `already_completed` and the current authoritative projection; announce “Already completed today” without a second reward animation.
5. `DAY_ROLLED_OVER` writes nothing. Explain that the day changed; refresh the date and projection. Require a new deliberate click, with no automatic resubmission. The same rule covers lost-response retries after midnight.
6. `HABIT_ARCHIVED` or `NOT_FOUND` refreshes the active list and gives a safe message. Missing and foreign-owned IDs share `NOT_FOUND`. Auth/session errors route to the appropriate entry state. Unexpected/connection errors show retry and no success feedback.

At a later read, a completion today/yesterday keeps the stored run visible; an older/absent completion displays zero current streak. Best streak and earned garden remain. Calendar arithmetic includes leap/month/year/DST boundaries.

## Archive a habit

1. Each active row has an “Archive” button with the habit name in its accessible label. Supporting text explains history and rewards are retained. No delete or reactivation action exists.
2. Submit sends only `habitId`; pending feedback preserves the row until success.
3. The service locks user then owned habit, sets the archive timestamp once, and returns success on replay. Completion-first retains its reward; archive-first prevents a new completion. An already-created same-day completion may return duplicate success after archive.
4. Success removes the row from the active list and preserves total/plants. Move focus to a sensible remaining row or the create form when the focused row is removed, then announce archival. If it was the last habit, show the empty state with starter/earned garden.
5. On failure retain current view and show safe retry/error feedback. Never imply logs or rewards were deleted.

## Garden and general UI states

| State | Required behavior |
|---|---|
| Empty habits | Explain how to create the first daily habit. Show the starter garden. |
| Garden | Slots 0–3 use clover/daisy/sunflower/cherry at totals 0/5/15/30. Locked slots explain their threshold. Owned slots show plant name, growth stage, and completion progress in text alongside authored SVG. No slot is an action. |
| Growth | Points are total minus unlock threshold; stage starts at 0/3/7/14 points. Newly unlocked plant starts at zero. Mature stays mature. |
| Initial loading | Keep a stable layout and descriptive loading text. Do not show fabricated counts or completed states. |
| Action pending | Retain existing content/input, disable initiating control, and communicate progress. Server idempotence remains required. |
| Validation | Labeled fields connect to inline messages with accessible descriptions; focus the first invalid field when useful. |
| Offline/unavailable | Preserve typed input where the page remains mounted, offer retry, and show no reward or success animation. |
| Day change | Refresh authoritative state and require deliberate resubmission. Browser time never creates a completion date. |

Use headings, real forms/buttons, visible keyboard focus, sufficient text contrast, status text beyond color, a polite live region, usable touch targets, and no horizontal content overflow at 320 px. Honor `prefers-reduced-motion`; animation completion never controls business state. Success does not unexpectedly move focus, except to restore focus after removal/navigation.

## Acceptance evidence

Follow AC01–AC10 and the three e2e journeys in [architecture](docs/02-architecture.md), with commands and pending status in [GATES](GATES.md). Automated sessions demonstrate app/session behavior; real local and production GitHub OAuth remain separate manual checks. No interaction or browser acceptance has run at this document checkpoint.
