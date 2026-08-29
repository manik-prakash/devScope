/**
 * The CLI sends session `stats` with snake_case keys
 * (cli/internal/api/client.go — SessionStats). The evaluator pipeline and the
 * frontend both read camelCase (see services/evaluator/index.ts readStats and
 * frontend/lib/types.ts SessionStats). normalizeStats bridges the two: it is
 * applied once at ingest so `Session.stats` is always stored in the camelCase
 * shape the rest of the system expects.
 *
 * It is intentionally NOT a Zod transform on SessionPayloadSchema — signature
 * verification must run against the exact bytes the CLI signed, which carry the
 * snake_case keys.
 */

export interface NormalizedStats {
  totalPrompts: number;
  totalResponses: number;
  totalIterations: number;
  totalToolCalls: number;
  filesChangedCount: number;
  shellCommandsCount: number;
  avgPromptLength: number;
  avgResponseLength: number;
  fileTypesTouched: string[];
  // Keeps the object assignable to Prisma's JSON input type.
  [key: string]: number | string[];
}

function num(value: unknown): number {
  // Coerce real numbers and numeric strings only. `Number(true)` is 1 and
  // `Number(null)` is 0 — never let those masquerade as a stat.
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Map raw CLI stats (snake_case, or already camelCase) onto the canonical
 * camelCase shape. Unknown / missing fields default to 0 / [].
 */
export function normalizeStats(raw: unknown): NormalizedStats {
  const s = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};

  const pick = (snake: string, camel: string): unknown =>
    s[snake] !== undefined ? s[snake] : s[camel];

  return {
    totalPrompts:       num(pick('total_prompts', 'totalPrompts')),
    totalResponses:     num(pick('total_responses', 'totalResponses')),
    totalIterations:    num(pick('total_iterations', 'totalIterations')),
    totalToolCalls:     num(pick('total_tool_calls', 'totalToolCalls')),
    filesChangedCount:  num(pick('files_changed_count', 'filesChangedCount')),
    shellCommandsCount: num(pick('shell_commands_count', 'shellCommandsCount')),
    avgPromptLength:    num(pick('avg_prompt_length', 'avgPromptLength')),
    avgResponseLength:  num(pick('avg_response_length', 'avgResponseLength')),
    fileTypesTouched:   stringArray(pick('file_types_touched', 'fileTypesTouched')),
  };
}
