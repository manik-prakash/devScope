import { z } from 'zod';

export const SessionPayloadSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string(),
  org_id: z.string(),
  project_id: z.string(),
  agent: z.string(),
  agent_version: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  duration_ms: z.number().int(),
  stats: z.record(z.any()),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
    content_length: z.number(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      input: z.string().optional(),
      output: z.string().optional(),
      is_file_modifying: z.boolean(),
      is_shell_command: z.boolean(),
    })).optional(),
    timestamp: z.string().optional(),
  })).optional(),
  cli_version: z.string(),
  signature: z.string(),
});
