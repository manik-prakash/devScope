import { describe, it, expect } from 'vitest';
import { verifySignature } from '../utils/crypto.js';

/**
 * Cross-implementation contract test.
 *
 * The payload, secret, and signature below were produced by the Go CLI signer
 * (`SignPayload` in cli/internal/pipeline/sign.go) — see
 * `TestSignPayload_CrossImplFixture` in cli/internal/pipeline/sign_test.go, which
 * pins the same values. This proves the backend's `verifySignature` reproduces
 * the exact canonical bytes the CLI hashed. Unlike signature.test.ts, the
 * expected signature here is NOT recomputed with this backend's own helpers, so a
 * divergence between the two canonicalisers fails this test.
 */
const SECRET = 'cross-impl-signing-secret';
const SIGNATURE =
  'dc8069baab2c49a21ae87508c9019b346fb8f52ae9df1e10a4caef2486467eec';

const PAYLOAD = {
  session_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  user_id: 'user-cross',
  org_id: 'org-cross',
  project_id: 'proj-cross',
  agent: 'claude-code',
  agent_version: '2.1.0',
  started_at: '2026-08-29T12:00:00Z',
  ended_at: '2026-08-29T12:30:00Z',
  duration_ms: 1800000,
  stats: {
    total_prompts: 4,
    total_responses: 4,
    total_iterations: 6,
    total_tool_calls: 9,
    files_changed_count: 2,
    shell_commands_count: 1,
    avg_prompt_length: 22.5,
    avg_response_length: 310,
    file_types_touched: ['go', 'ts'],
  },
  cli_version: '0.2.0',
};

describe('verifySignature — Go CLI cross-impl fixture', () => {
  it('accepts a signature produced by the Go signer', () => {
    expect(verifySignature({ ...PAYLOAD, signature: SIGNATURE }, SECRET)).toBe(true);
  });

  it('rejects it under a different secret', () => {
    expect(verifySignature({ ...PAYLOAD, signature: SIGNATURE }, 'wrong')).toBe(false);
  });

  it('rejects it when a field is tampered', () => {
    expect(
      verifySignature({ ...PAYLOAD, duration_ms: 1, signature: SIGNATURE }, SECRET),
    ).toBe(false);
  });
});
