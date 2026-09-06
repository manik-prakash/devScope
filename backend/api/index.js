// Vercel serverless entrypoint. Wraps the same compiled Express app that
// `pnpm start` runs (dist/app.js) — no separate, untested code path.
//
// server.ts (app.listen + SIGTERM handling + the setInterval reconcile sweep)
// is NOT used here: Vercel has no persistent process between invocations.
// The reconcile sweep runs via Vercel Cron hitting /api/v1/internal/reconcile
// instead (see vercel.json).
import { createApp } from '../dist/app.js'

export default createApp()
