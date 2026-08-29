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
same-origin — this is what lets the backend keep an HttpOnly `SameSite=Lax`
refresh cookie. **This same-origin rewrite is the supported deployment shape**;
in production set `API_PROXY_TARGET` to the backend origin and leave
`NEXT_PUBLIC_API_URL` unset.

Optional `frontend/.env.local`:

```
API_PROXY_TARGET=http://localhost:3001      # backend origin the rewrite points at
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1   # bypass the rewrite — see caveat
```

`NEXT_PUBLIC_API_URL` makes the browser call the backend directly. Only safe when it
resolves to the **same site** as the app (e.g. another port on `localhost`). Pointing it at a
different host makes the auth calls cross-site, so the `SameSite=Lax` `ds_refresh` cookie is
never sent and silent-refresh fails (~15-min forced re-login). Cross-host deployments would
need the cookie relaxed to `SameSite=None; Secure` (not currently wired — a
`CROSS_SITE_COOKIES` backend flag is the intended follow-up).

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
