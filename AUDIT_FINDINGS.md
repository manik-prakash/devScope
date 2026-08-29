# Remaining DevScope Audit Findings

Audit date: 2026-08-29 (revised during fix round 5)
Scope: unresolved or partially resolved correctness, security, reliability, duplication, and
repository-hygiene findings only.

Fixed findings have been removed. Item IDs (R-nn / D-nn) are retained from the previous
report so earlier references still resolve — gaps are expected.

**Fixed since the last revision:** R-05 (session-id idempotency now also checks project),
R-06 (malformed `.devscope.yaml` now errors), R-07 (register slug race → 409),
R-10 (refresh-cookie lifetime now driven by a backend `refreshExpiresAt`),
R-11 (`config.Set` now hardens file mode), R-12 (`parseDuration` rejects zero/overflow;
payload size bounds), R-13 (redaction now covers OpenAI/OpenRouter, Slack, Google, JWT, and
URL-embedded credentials), R-16 (unsupported agent now exits non-zero), D-04 doc/lint items.

**Fixed in round 5 (in progress):** R-14 (error-state coverage complete);
D-03 partial (route-group providers consolidated into `app/providers.tsx` — pagination/filter
UI is what's left); R-03 + D-02 (`SessionScore` dimensions now exposed on session list/detail
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
reads or writes the refresh token).

## Validation summary

- CLI: `go build`, `go vet`, `go test ./...` pass.
- Backend: type-check, lint (0 warnings), 62 tests, build pass.
- Frontend: TypeScript, 22 tests, lint (0 errors, 28 pre-existing `react-hooks/*` warnings),
  and production build pass.
- Tests remain primarily mocked/unit-level; there is no real database integration suite or
  browser end-to-end coverage.

Severity uses P0 (critical), P1 (high), P2 (medium), and P3 (cleanup). Confidence is high
unless marked intent-dependent.

## Remaining correctness and reliability findings

### R-01 — CLI operational failures still exit successfully (P1, intent-dependent)

Authentication/sync failures, status-fetch failures, and shipping failures print an error and
return `nil`, so shell scripts and CI cannot distinguish successful telemetry collection from
failed collection. The silent *parser*-error path was fixed (it now writes to stderr) and an
unsupported agent now exits non-zero, but the broader "print and exit 0" contract is
unchanged — `CLAUDE.md` documents it as deliberate ("a failed sync/status still exits 0";
"`main()` is the only non-zero exit path"). Changing it needs a product decision.

Evidence: `cli/cmd/sync.go:32-36`, `cli/cmd/status.go:63-67`, `cli/cmd/run.go` shipping path.

## Remaining duplication and repository hygiene

### D-01 — Auth/token behavior is duplicated across frontend modules (P2)

`frontend/lib/auth.ts` and `frontend/lib/api.ts` independently implement token access,
refresh, cookie handling, and cleanup. The two paths already differ in which cookies they
touch and can drift further when session-state changes are made.

### D-03 — Pagination/filter UI remains repeated (P2)

The session screens repeat filter and pagination components (e.g. a `PaginationBar`
reimplemented per screen with subtly different `safePage` handling). (The React Query
providers were consolidated into `app/providers.tsx`; the backend page/limit parser into
`parsePageParams`. The per-screen pagination/filter UI is what's left.)

### D-05 — Local secret hygiene requires follow-up (P1 if the credential is real)

`backend/.env` is gitignored and untracked but contains an actual-looking provider
credential. It must not be committed; if valid, it should be rotated and repository history
checked without exposing the value.

## Recommended remaining order

1. Decide on CLI exit semantics (R-01).
2. Consolidate duplicated auth logic (D-01) and the per-screen pagination/filter UI (D-03).
3. `backend/.env` credential hygiene (D-05).
