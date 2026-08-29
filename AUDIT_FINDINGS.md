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

**Fixed in round 5 (in progress):** R-14 (settings page + session detail drawer now render an
error state on request failure — error-state coverage is complete).

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

### R-02 — Frontend all-time views, statistics, and CSV export remain incomplete (P1)

Several screens request only the newest 100 or 200 sessions, then filter, aggregate,
paginate, or export locally. Older sessions stay invisible while the UI presents all-time
counts, averages, charts, project lists, and CSV exports as complete. The real fix is
server-side aggregation / cursor-paginated endpoints; an interim is honest "latest N" labels.

Evidence: `frontend/app/(developer)/me/sessions/page.tsx`,
`frontend/app/(manager)/dashboard/sessions/page.tsx`,
`frontend/app/(manager)/dashboard/page.tsx`, `frontend/lib/queries/me.ts`.

### R-03 — Frontend score breakdowns are heuristic duplicates, not evaluator scores (P1)

The backend stores per-dimension `SessionScore` values, but the session type and API
responses do not expose them. The dashboard and detail drawer independently re-derive
prompt-quality, iteration-efficiency, and tool-utilization from raw stats, so the displayed
breakdown does not represent the actual evaluator output. Fix needs new fields on the
session-detail responses + `Session` type, then a rewire of the two frontend call sites.

Evidence: `backend/prisma/schema.prisma:218-257`,
`backend/src/services/evaluator/index.ts:154-175`, `frontend/lib/queries/me.ts:21-31`,
`frontend/components/shared/SessionDetailDrawer.tsx:19-36,175-178`.

### R-04 — Evaluation is fire-and-forget with no recovery mechanism (P1)

The API persists a session, returns 202, and starts evaluation without durable job state. A
process crash after insertion can leave a session permanently `PENDING`; there is no worker,
retry queue, or reconciliation scan.

Evidence: `backend/src/controllers/cli.ts` (post-insert dispatch), evaluator status fields in
`backend/prisma/schema.prisma:187-208`.

## Remaining authentication and security findings

### R-08 — Refresh tokens are reusable after refresh (P1)

`/auth/refresh` validates the stored token and issues a new access token without rotating or
revoking the refresh token. A stolen token stays replayable until expiry despite revocation
fields existing in the schema.

Evidence: `backend/src/controllers/auth.ts` (`refresh`), RefreshToken model in
`backend/prisma/schema.prisma:260-277`.

### R-09 — Refresh-token browser storage is JavaScript-readable (P1)

The long-lived `ds_refresh` token is stored and read through `document.cookie`. `SameSite`
and `Secure` do not prevent an XSS payload from exfiltrating it. A backend-owned HttpOnly
cookie (set/read server-side, rotated on refresh) is the real fix.

Evidence: `frontend/lib/auth.ts:28-44`, `frontend/lib/api.ts:18-30`.

## Remaining frontend and product behavior findings

### R-15 — Organization deletion is a misleading destructive stub (P2)

The settings UI reports that an organization-deletion request was made, but the handler only
logs to the console and marks the flow confirmed. There is no backend deletion endpoint.
Either implement `DELETE /admin/org` (with a cascade decision) or remove the UI.

Evidence: `frontend/app/(manager)/dashboard/settings/page.tsx:318-329`.

### R-17 — Seat and plan limits are unenforced (P2, intent-dependent)

Organization `seats` and `plan` metadata exists and is displayed, but user creation and
project-membership flows do not enforce it. Either missing product logic or misleading dead
data; enforcing it may need a migration.

Evidence: `backend/prisma/schema.prisma`, `backend/src/controllers/admin.ts:25-45`,
`backend/src/controllers/manager.ts:152-207`.

## Remaining duplication and repository hygiene

### D-01 — Auth/token behavior is duplicated across frontend modules (P2)

`frontend/lib/auth.ts` and `frontend/lib/api.ts` independently implement token access,
refresh, cookie handling, and cleanup. The two paths already differ in which cookies they
touch and can drift further when session-state changes are made.

### D-02 — Score heuristic logic is duplicated across frontend modules (P2)

The same heuristic scoring lives in `frontend/lib/queries/me.ts:21-31` and
`frontend/components/shared/SessionDetailDrawer.tsx:19-36`, separate from the backend's
canonical evaluator model. Resolves naturally with R-03.

### D-03 — Provider and pagination/filter UI remains repeated (P2)

The `(manager)` and `(developer)` React Query providers are near-identical, and the session
screens repeat filter/pagination components. (The backend page/limit parser was consolidated
into `parsePageParams`; the frontend duplication is what's left.)

### D-05 — Local secret hygiene requires follow-up (P1 if the credential is real)

`backend/.env` is gitignored and untracked but contains an actual-looking provider
credential. It must not be committed; if valid, it should be rotated and repository history
checked without exposing the value.

## Recommended remaining order

1. Score-detail API exposure (R-03/D-02), all-time data loading (R-02), durable evaluation
   recovery (R-04).
2. Refresh-token lifecycle and storage hardening (R-08, R-09).
3. Decide on the org-delete flow (R-15) and CLI exit semantics (R-01).
4. Seat/plan enforcement (R-17); consolidate duplicated auth/provider logic (D-01, D-03).
