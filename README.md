# DevScope

Developer‑analytics for AI coding‑agent sessions. DevScope shows engineering managers how
their team actually uses tools like Claude Code and Codex — **without** raw prompts or code
ever leaving the developer's machine.

A local CLI wraps the agent, captures behavioural telemetry, redacts secrets, signs the
payload, and ships it to a backend that verifies it and runs a multi‑stage LLM evaluation. A
Next.js dashboard renders the scores and trends.

```
 developer                         backend                         dashboard
┌──────────────┐   signed JSON   ┌──────────────┐   SessionScore  ┌──────────────┐
│ devscope run │ ──────────────▶ │ verify HMAC  │ ──────────────▶ │ manager /    │
│  <agent>     │  (behavioural   │ 5‑stage      │                 │ developer    │
│  wrap+redact │   metadata only)│ LLM evaluator│                 │ views        │
└──────────────┘                 └──────────────┘                 └──────────────┘
```

## Repository layout

| Path | Stack | What it is |
|------|-------|------------|
| [`cli/`](cli/) | Go 1.26, Cobra | `devscope` — wraps an agent, snapshots the working tree, parses the agent's log, redacts, HMAC‑signs, ships (with an offline queue). |
| [`backend/`](backend/) | Express 4 + TypeScript (ESM), Prisma 7, PostgreSQL | `/api/v1` — auth, CLI ingest, manager/developer/admin APIs, and the OpenRouter‑backed session evaluator. |
| [`frontend/`](frontend/) | Next.js 16, React 19, Tailwind 4, TanStack Query | Manager and developer dashboards. |

Each component is independent — its own toolchain, its own package manager, no root workspace.

## Data model

```
Organization ─┬─ User (ADMIN | MANAGER | DEVELOPER) ─── ProjectMember ─── Project
              ├─ ApiKey (bearer key hash + HMAC signing secret)
              └─ Session ─── SessionScore (dimensions, overall, confidence, anomalies, trends)
```

A `Session` is immutable once received. `evaluationStatus` moves `PENDING → SCORED | FAILED`,
or `SKIPPED` when the signature doesn't verify.

## How a session is scored

1. **classify** (LLM) — task type / complexity / approach
2. **detectAnomalies** (deterministic) — 8 rules → `info | warning | flag`
3. **scoreDimensions** (LLM) — prompt quality / iteration efficiency / tool utilisation, 0–100
4. **analyzeTrends** (deterministic) — trajectory / consistency / streak vs. the developer's history
5. **synthesize** (LLM) — the written summary / strength / improvement focus

The overall score is computed in code: `0.4·prompt + 0.4·iteration + 0.2·tool`, minus
`8·flags + 3·warnings`, floored at 5. Every LLM stage has a fallback, so evaluation never
hard‑fails. The model is pinned in `backend/src/services/evaluator/prompts.ts`.

## Local setup

### 1. Backend (`backend/`)

Requires Node ≥ 20, `pnpm`, and Docker (for Postgres).

```bash
cd backend
pnpm install
docker compose up -d                # Postgres on :5432 (user/pass/db = devscope)
cp .env.example .env                 # then fill in OPENROUTER_API_KEY and a 32+ char JWT_SECRET
pnpm db:migrate
pnpm db:generate
pnpm db:seed                         # optional demo data — see credentials below
pnpm dev                             # http://localhost:3001
```

`pnpm db:seed` creates org `demo` with `admin@demo.test` / `dev@demo.test`, password
`demo-password-123`.

### 2. Frontend (`frontend/`)

Requires Node ≥ 20 and `npm`.

```bash
cd frontend
npm install
npm run dev                          # http://localhost:3000
```

`next.config.ts` rewrites `/api/v1/*` to the backend (`API_PROXY_TARGET`, default
`http://localhost:3001`), so the browser talks to the API **same-origin** — that is what lets
the backend own the HttpOnly `SameSite=Lax` `ds_refresh` cookie. This is the supported
deployment shape: in production point `API_PROXY_TARGET` at the backend origin and leave
`NEXT_PUBLIC_API_URL` unset. Setting `NEXT_PUBLIC_API_URL` to a backend on a **different host**
makes the browser call it cross-site, and the refresh cookie is then never sent — sessions
silently drop every ~15 min. (A different port on `localhost` is same-site, so it's fine for
local dev.)

### 3. CLI (`cli/`)

Requires Go 1.26.

```bash
cd cli
go build -o devscope .

export DEVSCOPE_API_BASE_URL=http://localhost:3001    # origin only — the client appends /api/v1
./devscope auth                                       # paste an API key from the dashboard
./devscope run claude                                 # wrap your agent
./devscope status                                     # recent sessions + scores
```

Config lives at `~/.devscope/`. Failed uploads are queued and retried on the next `run`.

## Common commands

| | Backend (`pnpm …`) | Frontend (`npm …`) | CLI (`go …`) |
|---|---|---|---|
| dev | `dev` | `run dev` | `run . --help` |
| build | `build` | `run build` | `build .` |
| test | `test` | `test` | `test ./...` |
| lint / vet | `lint` | `run lint` | `vet ./...` |
| type‑check | `type-check` | `npx tsc --noEmit` | — |
| DB | `db:migrate` · `db:seed` · `db:studio` · `db:reset` | — | — |

CI (`.github/workflows/ci.yml`) runs build + vet/type‑check + lint + tests for all three on
every push and PR.

## Privacy model

Only behavioural metadata and redacted message text leave the machine. File **contents** are
never read (snapshots record path/mtime/size only); file **names and paths** are never
transmitted (only extensions). Redaction runs field‑by‑field over message and tool text
against built‑in patterns (cloud keys, bearer tokens, private keys) plus any
`custom_strip_patterns` in a repo‑local `.devscope.yaml`.
