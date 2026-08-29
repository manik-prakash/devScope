import { describe, it, expect } from 'vitest';
import { SessionPayloadSchema } from '../validators/cli.js';

function base() {
  return {
    session_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'u1',
    org_id: 'o1',
    project_id: 'p1',
    agent: 'claude-code',
    agent_version: '1.0.0',
    started_at: '2026-08-29T10:00:00Z',
    ended_at: '2026-08-29T10:05:00Z',
    duration_ms: 300000,
    stats: { total_prompts: 2 },
    cli_version: '0.1.0',
    signature: 'abc',
  };
}

describe('SessionPayloadSchema', () => {
  it('accepts a well-formed payload', () => {
    expect(SessionPayloadSchema.safeParse(base()).success).toBe(true);
  });

  it('rejects an empty or non-ISO started_at', () => {
    expect(SessionPayloadSchema.safeParse({ ...base(), started_at: '' }).success).toBe(false);
    expect(SessionPayloadSchema.safeParse({ ...base(), started_at: '2026-13-99' }).success).toBe(false);
  });

  it('rejects a negative or fractional duration_ms', () => {
    expect(SessionPayloadSchema.safeParse({ ...base(), duration_ms: -1 }).success).toBe(false);
    expect(SessionPayloadSchema.safeParse({ ...base(), duration_ms: 1.5 }).success).toBe(false);
  });

  it('rejects an oversized messages array', () => {
    const messages = Array.from({ length: 5001 }, () => ({
      role: 'user',
      content: 'x',
      content_length: 1,
    }));
    expect(SessionPayloadSchema.safeParse({ ...base(), messages }).success).toBe(false);
  });

  it('rejects a non-numeric known stat field', () => {
    expect(
      SessionPayloadSchema.safeParse({ ...base(), stats: { total_prompts: 'lots' } }).success,
    ).toBe(false);
  });
});
