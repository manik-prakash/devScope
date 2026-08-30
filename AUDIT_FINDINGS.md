# DevScope Audit Findings — all resolved

Audit date: 2026-08-29 (round 5) · round 6 follow-ups 2026-08-30
Scope: correctness, security, reliability, duplication, and repository-hygiene findings.

**No findings remain open.** Rounds 1–5 and the round-6 follow-ups (a review of the round-5
work — mostly concurrency races and two incomplete polish passes) are all closed. This file
is kept as a record. Item IDs (R-nn / D-nn from the original report, F-n for round 6) are
retained so earlier references still resolve — gaps are expected.

## Round 6 — resolved

- **F1 — CLI auth tests were not isolated.** `overrideConfigDir` ignored its temp-dir arg and
  wrote to (and deleted on cleanup) the real `~/.devscope`. **FIXED** — it now calls
  `config.SetDirForTest(dir)`; `TestAuthTestsAreIsolated` guards it.
- **F2 — Refresh-token rotation race.** Concurrent `/auth/refresh` with one cookie could both
  pass the `revokedAt` check and each mint a replacement. **FIXED** — rotation runs an
  interactive `$transaction` with a conditional revoke (`where: { tokenHash, revokedAt:
  null }`); only `count === 1` mints a replacement.
  **F2-fix:** the first cut treated the race loser exactly like token reuse
  (`revokeTokenFamily`), which revoked the *winner's* fresh token → forced logout on any
  multi-tab refresh. **Grace window:** a spent token re-presented within `ROTATION_GRACE_MS`
  (30 s — the Okta / Auth0 default) is a concurrent refresh **iff it was revoked by rotation**,
  i.e. `RefreshToken.replacedByTokenHash` is set (new migration
  `20260830000000_refresh_token_replaced_by`). It gets a fresh access token; the `ds_refresh`
  cookie and token family are left untouched. A `null` link means the token was killed by
  logout / `change-password` — always a hard stop. Revoked outside the window → `revokeTokenFamily`
  + clear + 401. **Review follow-up (Finding 1):** the intermediate cut also checked that the
  spent token's *immediate* successor was still live; a chain that rotated twice inside the
  window (`T0→T1→T2`) then let a straggler holding `T0` see `T1` already revoked and nuke the
  live `T2`. The successor-liveness check is dropped — `replacedByTokenHash IS NOT NULL` +
  within-window is sufficient and matches how Okta / Auth0 / better-auth reconcile a grace
  period with reuse detection. The scoping concern from the earlier security review still
  holds: the check is "was *this* token recently rotated", never "does the user have *any*
  live token". **Finding 2:** a non-cookie caller (body `refreshToken`, tests only) that races
  itself gets an access token but no refreshed credential on the concurrent-refresh path —
  documented in a comment; only the cookie flow is supported for concurrent refresh.
- **F3 — Seat-limit concurrent oversubscription.** `assertSeatAvailable` counted users before
  `user.create` with no lock; concurrent invites could exceed `Organization.seats`. **FIXED**
  — `assertSeatAvailable(tx, orgId)` now takes a `SELECT id FROM organizations … FOR UPDATE`
  row lock first and both callers (`admin.createUser`, `manager.addProjectMember` fresh-user
  branch) run the check + `user.create` in one interactive `$transaction` (bcrypt stays
  outside the lock). Unit tests assert the lock precedes the count; true race coverage needs
  an integration DB (suite is mock-level).
- **F4 + F5 — Manager screens: truncation notices + `isError`.** **FIXED** (one commit). New
  shared `<TruncationNotice shown limit noun? />` (renders only when `shown >= limit`) drops
  into `projects/page`, `ProjectDetail`, `DeveloperDetail`, `settings/page`, and retro-fits
  the two existing inline captions in `dashboard/sessions` + `me/sessions`. `isError` is now
  consumed on every session/project/user query in those screens: a failed primary fetch
  (`useManagerProject` / `useManagerUsers`) renders the standard `AlertTriangle` `EmptyState`
  instead of "not found"; a failed `useManagerSessions` shows an inline warning in place of
  the truncation notice so stats/charts no longer read as real zeros.
- **F6 — Reconcile duplicated LLM work** across backend instances: separate instances
  selected the same stale `PENDING` rows and each dispatched the pipeline. **FIXED** — each
  candidate is now claimed with a conditional `session.updateMany({ where: { id,
  evaluationStatus: 'PENDING', OR: [{ evaluatedAt: null }, { evaluatedAt: { lt: reclaimCutoff
  } }] }, data: { evaluatedAt: now } })`; only the instance that gets `count === 1` dispatches.
  A claim that never reaches a terminal status is retried after `RECLAIM_AFTER_MS` (15 min).
  No migration — `evaluatedAt` doubles as the claim marker; nothing renders it for
  non-terminal rows.
- **F8 — Developer session-detail endpoint omitted `scoreDetail`.** R-03 added the real
  evaluator dimensions to session list/detail responses but missed
  `developer.getSessionById` — so the drawer fell back to the stats heuristic for a developer
  opening their own session. **FIXED** — `...scoreDetailInclude` added, matching
  `manager.getSessionById`; new `developer-controller.test.ts` guards both developer session
  handlers.
- **F7 — Cross-host `NEXT_PUBLIC_API_URL` breaks the refresh cookie** (`SameSite=Lax` won't
  ride a cross-site XHR). **FIXED (docs).** `README.md` no longer tells fresh installs to set
  `NEXT_PUBLIC_API_URL` (the rewrite already targets `localhost:3001`); both READMEs now state
  the same-origin `API_PROXY_TARGET` rewrite is the supported shape and that a different-host
  `NEXT_PUBLIC_API_URL` silently drops sessions every ~15 min. A `CROSS_SITE_COOKIES` backend
  flag (`SameSite=None; Secure`) is noted as the follow-up if cross-host is ever needed.
- **F9 — Dashboard partial API failures were hidden.** The manager `dashboard/page.tsx` fires
  two independent `useManagerSessions` queries (500-row stats slice + 10-row table slice) but
  only rendered the full-page error when *both* failed. A lone `statsError` left the stat
  cards showing `0 / – / 0 / —` and empty charts; a lone `tableError` fell through to the
  "No sessions yet" empty state. **FIXED** — `RecentSessionsTable` extracted to
  `frontend/components/manager/RecentSessionsTable.tsx` with a new `isError` prop that renders
  an `AlertTriangle` state ("Couldn't load recent sessions"); the page passes
  `isError={tableError}`. On `statsError` (short of the both-failed full-page case) the stat
  cards and charts are hidden entirely behind an amber `var(--warning)` notice, so nothing
  reads as a real zero. New `RecentSessionsTable.test.tsx` (4 tests) guards the state ladder.
  **Review follow-up:** the "Recent sessions" header no longer renders "0 total" next to the
  table's own error state — the count is hidden while `tableError`.
- **F10 — API-key load failure showed "No API keys yet".** `me/api-keys/page.tsx` dropped
  `isError` from `useApiKeys()`, so a failed fetch rendered the empty-state with a *Generate
  new key* CTA — a user who already has keys could mint a duplicate. **FIXED** — the page now
  consumes `isError` and renders an `AlertTriangle` "Couldn't load your API keys" state ahead
  of the empty check, mirroring `projects/page.tsx`. **Review follow-up:** the header
  *Generate new key* button is also suppressed in the `isError` state
  (`action={isError ? undefined : generateButton}`), so the duplicate-key hazard isn't
  reachable from the error screen either.
- **F11 — Concurrent invite of an existing user returned HTTP 500.** `manager.addProjectMember`'s
  existing-user branch did a check-then-`projectMember.create` with no P2002 handling: two
  simultaneous invites of the same user to the same project both saw no membership, then the
  loser of the `projectId_userId` unique race threw an unhandled `PrismaClientKnownRequestError`
  → 500. **FIXED** — the `create` is wrapped in a try/catch that maps `P2002` to the same
  `409 ALREADY_MEMBER` the pre-check returns (mirrors `createProject` and the fresh-user
  branch). `manager-controller.test.ts` gains a race test asserting 409, not 500.

---

## Rounds 1–5 — resolved

This section is kept as a record of what was found and how each item was closed.

**Fixed since the last revision:** R-05 (session-id idempotency now also checks project),
R-06 (malformed `.devscope.yaml` now errors), R-07 (register slug race → 409),
R-10 (refresh-cookie lifetime now driven by a backend `refreshExpiresAt`),
R-11 (`config.Set` now hardens file mode), R-12 (`parseDuration` rejects zero/overflow;
payload size bounds), R-13 (redaction now covers OpenAI/OpenRouter, Slack, Google, JWT, and
URL-embedded credentials), R-16 (unsupported agent now exits non-zero), D-04 doc/lint items.

**Fixed in round 5 (in progress):** R-14 (error-state coverage complete);
D-03 (route-group providers consolidated into `app/providers.tsx`; the per-screen pagination
and filter UI is now one `paginate()` helper plus shared `<Pagination>` / `<FilterSelect>`
components across all three session screens); R-03 + D-02 (`SessionScore` dimensions now exposed on session list/detail
responses; one shared `subScores()` prefers them, heuristic only as fallback);
R-04 (`reconcileStuckEvaluations` sweep at startup + every 10 min re-dispatches sessions left
`PENDING` by a crash); R-15 (`DELETE /api/v1/admin/org` — slug-confirmed, cascades to every
dependent row; the settings danger-zone now calls it and logs the user out);
R-17 (`assertSeatAvailable` blocks user creation past `Organization.seats` in `admin.createUser`
and `manager.addProjectMember`'s new-user branch — 403 `SEAT_LIMIT`; no migration, fields exist);
R-02 interim (session-list endpoints now allow a 500-row page via `SESSION_LIST_MAX_LIMIT`, a
shared `AGGREGATE_LIMIT`, "All time" relabelled "All loaded", and every affected screen
captions its numbers as "the most recent N sessions" — a real aggregation endpoint is still
the long-term fix);
R-08 + R-09 (`ds_refresh` is now an HttpOnly, backend-owned cookie — rotated on every
`/auth/refresh` with revoked-token-reuse detection that kills the whole family; a Next
`rewrites()` makes `/api/v1/*` same-origin so `SameSite=Lax` suffices; the frontend no longer
reads or writes the refresh token);
D-01 (the `ds_access` / `ds_user` accessors now live once in `lib/token-storage.ts` — `lib/auth.ts`,
`lib/api.ts` and 5 components import it instead of touching `sessionStorage` directly);
R-01 (CLI exit codes, Option B — the "middle path": `api.GetMe` / `api.GetRecentSessions` now
wrap `ErrAuthRejected` (401) vs. `ErrUnavailable` (transport / 429 / 5xx); `sync` and `status`
`return err` on the actionable class and keep exit 0 on the transient class; `run` propagates
the wrapped agent's own exit code via `cmd.ExitError` (unwrapped in `main`), and every
post-agent telemetry failure is stderr-only and never changes that code).

## Validation summary

- CLI: `go build`, `go vet`, `go test ./...` pass.
- Backend: type-check, lint (0 warnings), 94 tests, build pass. New migration
  `20260830000000_refresh_token_replaced_by` — apply with `pnpm db:migrate` (dev) /
  `pnpm db:migrate:deploy` (prod).
- Frontend: TypeScript, 34 tests, lint (0 errors, 28 pre-existing `react-hooks/*` warnings),
  and production build pass.
- Tests remain primarily mocked/unit-level; there is no real database integration suite or
  browser end-to-end coverage.

Severity uses P0 (critical), P1 (high), P2 (medium), and P3 (cleanup).

## No open findings

Every item from rounds 1–5 is closed. Deferred long-term follow-ups noted above but not
tracked as findings: a real server-side aggregation endpoint (R-02's honest-labelling fix is
interim); a database integration / browser e2e test tier.
