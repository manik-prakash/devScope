# Remaining DevScope Audit Findings

Audit date: 2026-08-29  
Audit source: effective working tree on `fix/audit-round-2`, including existing uncommitted changes.  
Scope: unresolved or partially resolved correctness, security, reliability, duplication, and repository-hygiene findings only.

Fixed findings have been removed from this version of the report. No product code was changed during this re-audit.

## Validation summary

- CLI: `go test ./...` and `go vet ./...` pass.
- Backend: type-check, 55 tests, and build pass. ESLint still reports seven warnings.
- Frontend: TypeScript, 20 tests, and production build pass. ESLint still reports 28 warnings.
- Existing tests remain primarily mocked/unit-level; there is no real database integration suite or browser end-to-end coverage.

Severity uses P0 (critical), P1 (high), P2 (medium), and P3 (cleanup). Confidence is high unless marked intent-dependent.

## Remaining correctness and reliability findings

### R-01 — CLI operational failures still exit successfully (P1)

Authentication/sync failures, status-fetch failures, parse failures, unsupported agents, and shipping failures still commonly print an error and return `nil`. Shell scripts and CI cannot distinguish successful telemetry collection from failed collection.

Evidence: `cli/cmd/sync.go:32-36`, `cli/cmd/status.go:63-67`, `cli/cmd/run.go:137-146,226-230`.

### R-02 — Frontend all-time views, statistics, and CSV export remain incomplete (P1)

Several screens request only the newest 100 or 200 sessions, then filter, aggregate, paginate, or export locally. Older sessions remain invisible while the UI presents all-time counts, averages, charts, project lists, and CSV exports.

Evidence: `frontend/app/(developer)/me/sessions/page.tsx:109-145`, `frontend/app/(manager)/dashboard/sessions/page.tsx:130-243`, `frontend/app/(manager)/dashboard/page.tsx:151-214`, `frontend/lib/queries/me.ts:193-220`.

### R-03 — Frontend score breakdowns are still heuristic duplicates, not evaluator scores (P1)

The backend stores detailed `SessionScore` dimensions, but the frontend session type and API responses do not expose them. The dashboard and detail drawer independently derive prompt-quality, iteration-efficiency, and tool-utilization values from raw stats, so displayed breakdowns do not represent the actual evaluator output.

Evidence: `backend/prisma/schema.prisma:218-257`, `backend/src/services/evaluator/index.ts:154-175`, `frontend/lib/queries/me.ts:21-31`, `frontend/components/shared/SessionDetailDrawer.tsx:19-36,175-178`.

### R-04 — Evaluation is still fire-and-forget with no recovery mechanism (P1)

The API persists a session, returns 202, and starts evaluation without durable job state. A process crash after insertion can leave a session permanently `PENDING`; there is no worker, retry queue, or reconciliation scan.

Evidence: `backend/src/controllers/cli.ts:119-128`, evaluator status fields in `backend/prisma/schema.prisma:187-208`.

### R-05 — Duplicate session protection is incomplete (P1)

The endpoint now rejects an ID owned by another user, but accepts an existing row when only `userId` and `orgId` match. It does not compare project, API key, signature, or payload identity, so a reused ID with different telemetry can still return 202 while silently discarding the new payload.

Evidence: `backend/src/controllers/cli.ts:95-113`, `backend/prisma/schema.prisma:164-170`.

### R-06 — Malformed repo-local configuration is silently ignored (P2)

`ResolveProjectForDir` suppresses all `.devscope.yaml` read/parse errors and falls back to the global project. A malformed or unreadable repository configuration can therefore select the wrong project without telling the user.

Evidence: `cli/internal/config/config.go:274-290,325-335`.

### R-07 — Organization registration still has a uniqueness race (P2)

Registration checks the organization slug before entering the transaction, but a concurrent registration can win between the check and `organization.create`. The resulting Prisma `P2002` is not converted into the intended conflict response and becomes a 500.

Evidence: `backend/src/controllers/auth.ts:121-147`.

## Remaining authentication, security, and input findings

### R-08 — Refresh tokens are reusable after refresh (P1)

The refresh endpoint validates the stored token and issues a new access token without rotating or revoking the refresh token. A stolen token remains replayable until expiry despite revocation fields existing in the schema.

Evidence: `backend/src/controllers/auth.ts:76-103`, RefreshToken model in `backend/prisma/schema.prisma:260-277`.

### R-09 — Refresh-token browser storage is JavaScript-readable (P1)

The long-lived `ds_refresh` token is stored and read through `document.cookie`. SameSite and Secure flags do not prevent an XSS payload from exfiltrating it.

Evidence: `frontend/lib/auth.ts:28-44`, `frontend/lib/api.ts:18-30`.

### R-10 — Browser refresh-cookie lifetime is disconnected from backend configuration (P2)

The backend now parses configured durations, but the frontend still hard-codes the refresh cookie to seven days. A deployment configured for another token lifetime can retain a browser cookie longer or shorter than the server-side token.

Evidence: `backend/src/controllers/auth.ts:11-33`, `frontend/lib/auth.ts:34-39`.

### R-11 — Credential-file hardening is incomplete for `config set` (P1)

`config.Save` now applies `chmod 0600`, but the Viper-based `config.Set` path writes the credential file without explicitly tightening permissions. The file stores the API key and signing secret.

Evidence: `cli/internal/config/config.go:154-174,190-216`.

### R-12 — CLI payload validation still permits oversized or semantically invalid values (P2)

Known fields have stronger schemas, but there is no upper bound for duration, content length, or version strings; unknown stats pass through via `.passthrough()`; and `parseDuration` accepts values that can overflow or produce a zero lifetime. These values can create bad metrics or invalid persistence behavior.

Evidence: `backend/src/validators/cli.ts:4-49`, `backend/src/utils/duration.ts:13-21`, `backend/src/controllers/cli.ts:45-60`.

### R-13 — Secret-redaction coverage remains narrower than the product guarantee (P1)

Invalid custom patterns are now surfaced, but built-in patterns still omit common provider keys, OpenAI/OpenRouter-style keys, Slack tokens, JWTs, and credentials embedded in URLs or query strings. The product documentation promises that secrets never leave the machine.

Evidence: `cli/internal/pipeline/redact.go:10-20,48-57`, security guarantee in the root README.

## Remaining frontend and product behavior findings

### R-14 — Frontend error-state handling is only partially fixed (P2)

Some session and team pages now show an error state, but dashboard statistics, project views, developer sessions, settings, and detail screens still default to empty or zero data when requests fail. Outages and permission errors can be misreported as legitimate empty results.

Evidence: `frontend/app/(manager)/dashboard/page.tsx:151-214`, `frontend/app/(manager)/dashboard/projects/page.tsx:194-196`, `frontend/app/(developer)/me/sessions/page.tsx:109-170`, `frontend/app/(manager)/dashboard/settings/page.tsx:127-149`.

### R-15 — Organization deletion remains a misleading destructive stub (P2)

The settings UI claims an organization deletion request was made, but the handler only logs to the console and marks the flow confirmed. There is no backend deletion endpoint.

Evidence: `frontend/app/(manager)/dashboard/settings/page.tsx:318-329`.

### R-16 — Unsupported agents still appear executable and exit successfully (P2)

`devscope run [agent]` accepts arbitrary names, but only Claude and Codex have adapters. Other agents print “not implemented” and return success without telemetry.

Evidence: `cli/cmd/run.go:17-27,125-134`, `cli/internal/agent/adapters/interface.go:4-6`.

### R-17 — Seat and plan limits are still unenforced (P2, intent-dependent)

Organization `seats` and `plan` metadata exists, but user creation and project-membership flows do not enforce those limits. This is either missing product logic or misleading dead data.

Evidence: `backend/prisma/schema.prisma`, `backend/src/controllers/admin.ts:25-45`, `backend/src/controllers/manager.ts:152-207`.

## Remaining duplication and repository hygiene

### D-01 — Auth/token behavior is duplicated across frontend modules (P2)

`frontend/lib/auth.ts` and `frontend/lib/api.ts` independently implement token access, refresh, cookie handling, and cleanup. Their behavior can drift when security or session-state changes are made.

### D-02 — Score heuristic logic is duplicated across frontend modules (P2)

The same heuristic scoring logic remains in `frontend/lib/queries/me.ts:21-31` and `frontend/components/shared/SessionDetailDrawer.tsx:19-36`, while the backend has a separate canonical evaluator model.

### D-03 — Provider and pagination/filter logic remains repeated (P2)

Manager/developer React Query providers are near-identical, session screens repeat filter/pagination UI, and backend controllers still require shared pagination/input helpers beyond the current page/limit parser.

### D-04 — Documentation and generated-artifact cleanup remains outstanding (P3)

`CLAUDE.md` still contains claims contradicted by the current implementation, `frontend/README.md` remains create-next-app boilerplate, and ignored `backend/dist` contains stale-looking compiled output. Backend and frontend lint warnings also remain.

### D-05 — Local secret hygiene requires follow-up (P1 if credential is real)

`backend/.env` is ignored but contains an actual-looking provider credential. It must not be committed; if valid, it should be rotated and repository history should be checked without exposing the value.

## Recommended remaining order

1. Fix CLI exit semantics, incomplete frontend data loading, score-detail exposure, and durable evaluation recovery.
2. Harden refresh-token lifecycle/storage, credential permissions, session idempotency, validation, and redaction.
3. Remove misleading stubs and unsupported-agent success paths.
4. Consolidate duplicated logic and refresh documentation/artifact hygiene.
