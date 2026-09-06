/**
 * Shared LLM helper for every JSON-returning stage in the pipeline.
 *
 * Behaviour contract:
 *   - 15-second timeout per request
 *   - response_format: { type: 'json_object' }
 *   - strips markdown fences before JSON.parse
 *   - validates with the supplied Zod schema
 *   - retries once on any failure (timeout, parse error, schema mismatch)
 *   - never throws — returns { ok: false, reason } after two failed attempts
 */

// Named import, not default: openai's dual CJS/ESM package.json makes the
// default export hit the same TypeScript NodeNext dual-package resolution bug
// as helmet did in app.ts (microsoft/TypeScript#50466) — "not constructable"
// on Vercel's build machine only. The named `OpenAI` export (openai also
// re-exports it that way) resolves through a plain named-export path that
// isn't affected.
import { OpenAI } from 'openai';
import type { ZodTypeAny, z } from 'zod';
import { env } from '../../config/env.js';
import { MODEL } from './prompts.js';
import type { LLMResult } from './types.js';

// ─── Shared client ───────────────────────────────────────────────────────────

const client = new OpenAI({
  apiKey:  env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': 'https://devscope.io',
    'X-Title':      'DevScope Evaluator',
  },
});

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2;

// ─── Options + entry point ───────────────────────────────────────────────────

export interface CallLLMJsonOptions<S extends ZodTypeAny> {
  /** Human-readable label for log lines, e.g. "classification". */
  label:  string;
  system: string;
  user:   string;
  schema: S;
}

export async function callLLMJson<S extends ZodTypeAny>(
  opts: CallLLMJsonOptions<S>,
): Promise<LLMResult<z.infer<S>>> {
  let lastReason = 'unknown';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await attemptOnce(opts);
    if (result.ok) return result;
    lastReason = result.reason;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[evaluator] ${opts.label} attempt ${attempt} failed: ${result.reason}`);
    }
  }

  console.error(`[evaluator] ${opts.label} failed after ${MAX_ATTEMPTS} attempts: ${lastReason}`);
  return { ok: false, reason: lastReason };
}

// ─── One attempt ─────────────────────────────────────────────────────────────

async function attemptOnce<S extends ZodTypeAny>(
  opts: CallLLMJsonOptions<S>,
): Promise<LLMResult<z.infer<S>>> {
  let content: string;
  try {
    const completion = await client.chat.completions.create(
      {
        model:           MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user',   content: opts.user   },
        ],
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    const raw = completion.choices[0]?.message.content;
    if (!raw || raw.trim() === '') {
      return { ok: false, reason: 'empty response' };
    }
    content = raw;
  } catch (err) {
    return { ok: false, reason: `request error: ${describeError(err)}` };
  }

  // Some models still wrap JSON in fences even when response_format is set.
  const cleaned = stripFences(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, reason: `JSON.parse: ${describeError(err)}` };
  }

  const validation = opts.schema.safeParse(parsed);
  if (!validation.success) {
    return { ok: false, reason: `schema mismatch: ${validation.error.issues[0]?.message ?? 'invalid shape'}` };
  }

  return { ok: true, data: validation.data as z.infer<S> };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip ```json ... ``` or ``` ... ``` fences if the model wrapped its output
 * despite the response_format hint. Leaves un-fenced JSON untouched.
 */
export function stripFences(s: string): string {
  const trimmed = s.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  // Remove the opening fence (optionally with a language tag) and the closing one.
  const withoutOpening = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
  const withoutClosing = withoutOpening.replace(/\n?```\s*$/, '');
  return withoutClosing.trim();
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
