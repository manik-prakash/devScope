/**
 * src/config/env.ts
 *
 * Validates all required environment variables at process startup using Zod.
 * Import this module before anything else in src/server.ts so that a clear,
 * actionable error is thrown immediately if configuration is missing.
 *
 * Usage:
 *   import { env } from './config/env.js'
 *   console.log(env.PORT) // typed, validated
 */

import { z } from 'zod'
import 'dotenv/config'
// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── Server ────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a numeric string')
    .default('3001')
    .transform(Number),

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .startsWith('postgresql://', 'DATABASE_URL must start with postgresql://'),

  // ── JWT ───────────────────────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),

  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── OpenRouter ────────────────────────────────────────────────────────────
  OPENROUTER_API_KEY: z
    .string()
    .min(1, 'OPENROUTER_API_KEY is required'),

  OPENROUTER_BASE_URL: z
    .string()
    .url('OPENROUTER_BASE_URL must be a valid URL')
    .default('https://openrouter.ai/api/v1'),

  // Note: the evaluator model is intentionally hardcoded in
  // src/services/evaluator/prompts.ts (MODEL) so the pipeline can't be pointed
  // at a paid model — there is deliberately no OPENROUTER_MODEL env var.

  // ── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ── Cross-origin deployment ─────────────────────────────────────────────
  // Set true when the frontend and backend are on different origins (no
  // same-origin Next.js rewrite in front) so the ds_refresh cookie is issued
  // as SameSite=None; Secure instead of the same-origin-only SameSite=Lax.
  CROSS_SITE_COOKIES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // ── Cron ─────────────────────────────────────────────────────────────────
  // Vercel Cron sends this exact env var's value as `Authorization: Bearer
  // <value>` to routes it invokes on schedule — required only when the
  // reconcile sweep runs via Vercel Cron rather than the in-process interval.
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required').optional(),
})

// ---------------------------------------------------------------------------
// Parse + export
// ---------------------------------------------------------------------------

function parseEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    console.error(
      '\n❌  DevScope backend failed to start — invalid environment configuration:\n' +
        issues +
        '\n\nCopy .env.example → .env and fill in the missing values.\n',
    )
    process.exit(1)
  }

  return result.data
}

export const env = parseEnv()

// Derived helpers
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim())

export type Env = z.infer<typeof envSchema>
