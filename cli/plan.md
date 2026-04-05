# DevScope CLI Incremental Build Plan

## Summary
We’ll build the `cli/` app from scratch in the exact 16-step order you defined, with each step producing complete files only, followed by concrete test commands. The plan assumes an env-driven backend base URL, a dedicated recent-sessions API for `status`, and a temporary GitHub/module placeholder that we can replace later without changing the internal package layout.

## Implementation Changes
- Initialize a new Go module in `cli/` using a placeholder module path such as `github.com/example/devscope-cli`, with a root Cobra app, injected `version` variable, and a consistent command registration pattern from Step 1 onward.
- Centralize filesystem conventions early:
  `~/.devscope/config.yaml`, `~/.devscope/queue/`, and `~/.devscope/logs/` will be resolved through one config/path helper layer so later steps do not duplicate path logic.
- Treat backend URL as required runtime configuration via `DEVSCOPE_API_BASE_URL`.
  `auth`, `sync`, `status`, and shipping code will fail with human-readable guidance if it is missing.
- Define typed API client models up front for:
  `GET /api/v1/me`
  `POST /api/v1/sessions`
  planned `GET /api/v1/sessions/recent?limit=5`
- Introduce a shared normalized session model before adapters/pipeline wiring so Claude and Codex parsers feed the same redaction, extraction, signing, and shipping stages.
- Implement adapters in layers:
  raw JSONL parsing first (`parse_claude.go`, `parse_codex.go`), then adapter-facing normalization and stub adapters for Cursor/Copilot with explicit “not implemented yet” behavior where needed.
- Keep redaction fully in-memory:
  serialize normalized session to JSON, apply built-in regex rules plus repo-local `.devscope.yaml` custom patterns, deserialize, then emit only redaction counts to `~/.devscope/logs/redaction.log`.
- Store failed outbound deliveries as the exact final signed JSON payload in `~/.devscope/queue/<session_id>.json`.
  Queue draining happens at the start of `devscope run`, before new session processing.
- Detect agent binaries and versions separately:
  command resolution in `internal/agent/detect.go`, version probing best-effort per agent, fallback to `"unknown"`.
- `status` will display cached identity/project info, fetch recent sessions from a minimal typed response shape like:
  `{ "sessions": [{ "session_id": "...", "agent": "...", "started_at": "...", "score": 0, "status": "queued|scored|failed" }] }`
  and compare the current CLI version against the latest GitHub release using the same temporary repo placeholder until you replace it.

## Step-by-Step Delivery Contract
- Before each implementation step, I will pause and ask for confirmation to start that specific step, per your requirement.
- During each step, I will provide the complete contents of every new or changed file for that step, not snippets.
- After each step, I will give exact commands to run from `m:\Projects\main-projects\devscope\cli` to validate that step.
- I will avoid pulling later-step complexity forward unless it is required to keep earlier steps clean and reusable.

## Test Plan
- Step 1: `go run . --help`, `go run . --version`
- Step 2: config read/write round-trip and missing-config behavior
- Step 3: API client tests against mocked HTTP server for `/api/v1/me` and `/api/v1/sessions`
- Step 4: auth happy path, invalid-key path, config persistence
- Steps 5-6: parser fixtures for Claude/Codex JSONL, including fallback session ID logic
- Steps 7-12: snapshot/diff, normalization, redaction counts, metadata extraction, canonical signing determinism, retry/queue drain behavior
- Step 13: end-to-end run flow with mocked session files and mocked backend
- Steps 14-16: status output, sync/config/logout flows, and GoReleaser config validation

## Assumptions
- Go module/release repo uses a temporary placeholder until you provide the final GitHub owner/repo.
- `DEVSCOPE_API_BASE_URL` is mandatory and is not persisted in config.
- `status` uses a dedicated recent-sessions endpoint with the minimal typed response above.
- Queue files contain only the final signed payload JSON, with no extra retry metadata.
- Cursor and Copilot adapters are intentionally stubbed first, while Claude Code and Codex are fully functional in the initial implementation.
