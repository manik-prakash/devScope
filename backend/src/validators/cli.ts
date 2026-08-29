import { z } from 'zod';

// Known stat fields the CLI sends (snake_case — the exact wire shape the HMAC
// signs). Unknown keys pass through for forward-compat; known keys are typed so
// a garbage value can't reach normalizeStats / the evaluator.
const StatsSchema = z
  .object({
    total_prompts: z.number(),
    total_responses: z.number(),
    total_iterations: z.number(),
    total_tool_calls: z.number(),
    files_changed_count: z.number(),
    shell_commands_count: z.number(),
    avg_prompt_length: z.number(),
    avg_response_length: z.number(),
    file_types_touched: z.array(z.string()),
  })
  .partial()
  .passthrough();

export const SessionPayloadSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().min(1),
  org_id: z.string().min(1),
  project_id: z.string().min(1),
  agent: z.string().min(1).max(64),
  agent_version: z.string().max(64),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  // Cap at ~1 year — well past any real coding session, and keeps a bogus value
  // from overflowing a Date / BigInt downstream.
  duration_ms: z.number().int().nonnegative().max(31_536_000_000),
  stats: StatsSchema,
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().max(1_000_000),
    content_length: z.number().nonnegative(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      input: z.string().optional(),
      output: z.string().optional(),
      is_file_modifying: z.boolean(),
      is_shell_command: z.boolean(),
    })).optional(),
    timestamp: z.string().optional(),
  })).max(5000).optional(),
  cli_version: z.string().max(64),
  signature: z.string(),
});
