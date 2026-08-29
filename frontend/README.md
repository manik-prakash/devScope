# DevScope — frontend

Manager and developer dashboards for [DevScope](../README.md). Next.js 16 (App Router,
Turbopack) + React 19 + Tailwind 4 (CSS‑first) + TanStack Query. Reads the session scores and
trends produced by [`backend/`](../backend/); it does not talk to the CLI.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
```

Needs `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

The backend must be running separately, and its `CORS_ORIGINS` must include
`http://localhost:3000`. There is no Next rewrite/proxy layer.

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
