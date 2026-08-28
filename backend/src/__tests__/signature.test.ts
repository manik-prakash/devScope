import { describe, it, expect } from 'vitest';
import { canonicalJson, hmacSha256, verifySignature } from '../utils/crypto.js';

/**
 * This literal must stay byte-for-byte identical to `canonicalContractJSON` in
 * cli/internal/pipeline/sign_test.go. It proves the Go CLI and this backend
 * canonicalise a payload the same way (sorted keys recursively, no HTML
 * escaping of < > &) — which is what makes the HMAC signature verify.
 */
const CANONICAL_CONTRACT =
  '{"agent":"claude-code","cli_version":"0.1.0","duration_ms":300000,"stats":{"avg_prompt_length":15.5,"total_prompts":2},"user_id":"u<1>"}';

describe('canonicalJson', () => {
  it('matches the CLI canonical contract', () => {
    const obj = {
      user_id: 'u<1>',
      agent: 'claude-code',
      cli_version: '0.1.0',
      duration_ms: 300000,
      stats: { total_prompts: 2, avg_prompt_length: 15.5 },
    };
    expect(canonicalJson(obj)).toBe(CANONICAL_CONTRACT);
  });
});

describe('verifySignature', () => {
  const secret = 'signing-secret-abc';
  const payload = {
    session_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'u1',
    org_id: 'o1',
    project_id: 'p1',
    agent: 'claude-code',
    agent_version: '1.0.0',
    started_at: '2026-08-29T10:00:00Z',
    ended_at: '2026-08-29T10:05:00Z',
    duration_ms: 300000,
    stats: {
      total_prompts: 2,
      total_iterations: 2,
      avg_prompt_length: 15.5,
      file_types_touched: ['go'],
    },
    messages: [{ role: 'user', content: 'a<b>c', content_length: 5 }],
    cli_version: '0.1.0',
  };

  it('accepts a signature computed the way the CLI computes it', () => {
    const signature = hmacSha256(secret, canonicalJson(payload));
    expect(verifySignature({ ...payload, signature }, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const signature = hmacSha256(secret, canonicalJson(payload));
    expect(verifySignature({ ...payload, duration_ms: 999, signature }, secret)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const signature = hmacSha256(secret, canonicalJson(payload));
    expect(verifySignature({ ...payload, signature }, 'other-secret')).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifySignature({ ...payload }, secret)).toBe(false);
  });
});
