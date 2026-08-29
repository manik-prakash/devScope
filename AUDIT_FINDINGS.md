# DevScope Audit Findings

Audit date: 2026-08-29 (round 5) · round 6 follow-ups opened 2026-08-30
Scope: correctness, security, reliability, duplication, and repository-hygiene findings.

Rounds 1–5 are fully closed (history below). **Round 6** tracks 7 follow-up findings from a
review of the round-5 work — mostly concurrency races and two incomplete polish passes.
Item IDs (R-nn / D-nn from the original report, F-n for round 6) are retained so earlier
references still resolve — gaps are expected.

## Round 6 — open

- **F1 — CLI auth tests were not isolated.** `overrideConfigDir` ignored its temp-dir arg and
  wrote to (and deleted on cleanup) the real `~/.devscope`. **FIXED** — it now calls
  `config.SetDirForTest(dir)`; `TestAuthTestsAreIsolated` guards it.
- **F2 — Refresh-token rotation race.** Concurrent `/auth/refresh` with one cookie could both
  pass the `revokedAt` check and each mint a replacement. **FIXED** — rotation now runs an
  interactive `$transaction` whose revoke is conditional (`where: { tokenHash, revokedAt:
  null }`); `count === 0` means another request already rotated, and is handled exactly like
  token reuse (`revokeTokenFamily` + clear cookie + 401). Shared `revokeTokenFamily` helper.
- **F3 — Seat-limit concurrent oversubscription.** `assertSeatAvailable` counted users before
  `user.create` with no lock; concurrent invites could exceed `Organization.seats`. **FIXED**
  — `assertSeatAvailable(tx, orgId)` now takes a `SELECT id FROM organizations … FOR UPDATE`
  row lock first and both callers (`admin.createUser`, `manager.addProjectMember` fresh-user
  branch) run the check + `user.create` in one interactive `$transaction` (bcrypt stays
  outside the lock). Unit tests assert the lock precedes the count; true race coverage needs
  an integration DB (suite is mock-level).
- **F4 — Aggregation-limit labelling still partial.** Project list/detail, developer detail,
  and settings compute from the capped 500-session fetch without a truncation notice.
- **F5 — `isError` still not surfaced** on `useManagerProject` / `useManagerUsers` /
  `useManagerSessions` in project detail, developer detail, and settings — failed fetches
  render as empty/zero or "not found".
- **F6 — Reconcile duplicates LLM work** across backend instances: separate instances select
  the same stale `PENDING` rows and each dispatch the pipeline. Needs an atomic claim.
- **F7 — Cross-host `NEXT_PUBLIC_API_URL` breaks the refresh cookie** (`SameSite=Lax` won't
  ride a cross-site XHR). Docs to steer deployments to the same-origin rewrite.

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
- Backend: type-check, lint (0 warnings), 80 tests, build pass.
- Frontend: TypeScript, 27 tests, lint (0 errors, 28 pre-existing `react-hooks/*` warnings),
  and production build pass.
- Tests remain primarily mocked/unit-level; there is no real database integration suite or
  browser end-to-end coverage.

Severity uses P0 (critical), P1 (high), P2 (medium), and P3 (cleanup).

## No open findings

Every item from rounds 1–5 is closed. Deferred long-term follow-ups noted above but not
tracked as findings: a real server-side aggregation endpoint (R-02's honest-labelling fix is
interim); a database integration / browser e2e test tier.
