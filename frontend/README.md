# DevScope — frontend

Manager and developer dashboards for [DevScope](../README.md). Next.js 16 (App Router,
Turbopack) + React 19 + Tailwind 4 (CSS‑first) + TanStack Query. Reads the session scores and
trends produced by [`backend/`](../backend/); it does not talk to the CLI.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
```

The backend must be running separately (`http://localhost:3001` by default).
`next.config.ts` rewrites `/api/v1/*` to it, so the browser talks to the API
same-origin (this is what lets the backend keep an HttpOnly refresh cookie).

Optional `frontend/.env.local`:

```
API_PROXY_TARGET=http://localhost:3001      # backend origin the rewrite points at
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1   # only to bypass the rewrite
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm run start` | production build / serve |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest (`vitest run`) |
| `npx tsc --noEmit` | type‑check (no `typecheck` script) |

## Layout notes

- Route groups: `(auth)` (no providers), `(developer)` → `/me`, `(manager)` → `/dashboard`.
- `middleware.ts` is renamed **`proxy.ts`** (edge route guard; defense‑in‑depth only).
- One axios instance in `lib/api.ts` (single‑flight 401 refresh). Access token in
  `sessionStorage`; `ds_refresh` / `ds_role` / `ds_must_change` in cookies.
- Dark theme only; design tokens in `app/globals.css`. Charts use `recharts`.

See [`AGENTS.md`](AGENTS.md) — this is not the Next.js in your training data.
