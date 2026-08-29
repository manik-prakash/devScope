import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { canonicalJson, hmacSha256 } from '../utils/crypto.js';
import { mockReq, mockRes } from './helpers/http.js';

vi.mock('../services/evaluator/index.js');
import { evaluatePipeline } from '../services/evaluator/index.js';
import { createSession, getRecentSessions } from '../controllers/cli.js';

const evaluatePipelineMock = vi.mocked(evaluatePipeline);

const SIGNING_SECRET = 'signing-secret-abc';

function payloadBody() {
  return {
    session_id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user-1',
    org_id: 'org-1',
    project_id: 'proj-1',
    agent: 'claude-code',
    agent_version: '1.0.0',
    started_at: '2026-08-29T10:00:00Z',
    ended_at: '2026-08-29T10:05:00Z',
    duration_ms: 300000,
    stats: { total_prompts: 2, total_iterations: 2 },
    cli_version: '0.1.0',
  };
}

function signed(body: Record<string, unknown>) {
  return { ...body, signature: hmacSha256(SIGNING_SECRET, canonicalJson(body)) };
}

const P2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
  code: 'P2002',
  clientVersion: 'test',
});

/**
 * @param created  the row `session.create` resolves to (fresh insert)
 * @param existing when set, `session.create` rejects with P2002 and
 *                 `session.findUnique` resolves to this row (row already there)
 */
function buildReq(
  body: Record<string, unknown>,
  { created, existing }: { created?: Record<string, unknown>; existing?: Record<string, unknown> },
) {
  const create = existing
    ? vi.fn().mockRejectedValue(P2002)
    : vi.fn().mockResolvedValue(created);
  const findUnique = vi.fn().mockResolvedValue(existing ?? created ?? null);

  return mockReq({
    body,
    user: { userId: 'user-1', orgId: 'org-1', role: 'DEVELOPER', type: 'apikey' },
    apiKey: { id: 'key-1', userId: 'user-1', orgId: 'org-1', signingSecret: SIGNING_SECRET },
    prisma: {
      projectMember: { findUnique: vi.fn().mockResolvedValue({ projectId: 'proj-1', userId: 'user-1' }) },
      session: { create, findUnique },
    },
  });
}

beforeEach(() => {
  evaluatePipelineMock.mockReset();
  evaluatePipelineMock.mockResolvedValue(undefined);
});

describe('createSession — evaluation dispatch', () => {
  it('responds 202 without awaiting the evaluation pipeline', async () => {
    evaluatePipelineMock.mockReturnValue(new Promise(() => {})); // never resolves
    const req = buildReq(signed(payloadBody()), { created: { id: 's1', evaluationStatus: 'PENDING' } });
    const res = mockRes();

    await createSession(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ session_id: 's1' });
  });

  it('runs evaluation exactly once for a freshly created PENDING session', async () => {
    const req = buildReq(signed(payloadBody()), { created: { id: 's1', evaluationStatus: 'PENDING' } });
    await createSession(req, mockRes());

    expect(evaluatePipelineMock).toHaveBeenCalledTimes(1);
    expect(evaluatePipelineMock).toHaveBeenCalledWith('s1');
  });

  it('does not dispatch evaluation on a concurrent duplicate submit by the same owner', async () => {
    // The row already exists and may still be PENDING because the first request's
    // pipeline is in flight — the second request must not start a second pipeline.
    const req = buildReq(signed(payloadBody()), {
      existing: { id: 's1', evaluationStatus: 'PENDING', userId: 'user-1', orgId: 'org-1', projectId: 'proj-1' },
    });
    const res = mockRes();

    await createSession(req, res);

    expect(evaluatePipelineMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ session_id: 's1' });
  });

  it('409s when the id is reused for a different project (different telemetry)', async () => {
    const req = buildReq(signed(payloadBody()), {
      existing: { id: 's1', evaluationStatus: 'SCORED', userId: 'user-1', orgId: 'org-1', projectId: 'proj-other' },
    });

    await expect(createSession(req, mockRes())).rejects.toMatchObject({ statusCode: 409 });
    expect(evaluatePipelineMock).not.toHaveBeenCalled();
  });

  it('409s when the session id already exists but belongs to another user', async () => {
    const req = buildReq(signed(payloadBody()), {
      existing: { id: 's1', evaluationStatus: 'SCORED', userId: 'someone-else', orgId: 'org-1' },
    });

    await expect(createSession(req, mockRes())).rejects.toMatchObject({ statusCode: 409 });
    expect(evaluatePipelineMock).not.toHaveBeenCalled();
  });

  it('400s on a backwards timestamp window', async () => {
    const body = signed({ ...payloadBody(), started_at: '2026-08-29T10:05:00Z', ended_at: '2026-08-29T10:00:00Z' });
    const req = buildReq(body, { created: { id: 's1', evaluationStatus: 'PENDING' } });

    await expect(createSession(req, mockRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('stores SKIPPED and skips evaluation when the signature is invalid', async () => {
    const body = { ...payloadBody(), signature: 'deadbeef' };
    const req = buildReq(body, { created: { id: 's1', evaluationStatus: 'SKIPPED' } });
    const create = (req.prisma as { session: { create: ReturnType<typeof vi.fn> } }).session.create;

    await createSession(req, mockRes());

    expect(evaluatePipelineMock).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.evaluationStatus).toBe('SKIPPED');
  });
});

describe('getRecentSessions', () => {
  it('maps evaluationStatus to the CLI vocabulary (queued/scored/failed)', async () => {
    const rows = [
      { id: 'a', agent: 'claude-code', startedAt: new Date(), score: null, evaluationStatus: 'PENDING' },
      { id: 'b', agent: 'claude-code', startedAt: new Date(), score: 82, evaluationStatus: 'SCORED' },
      { id: 'c', agent: 'codex', startedAt: new Date(), score: null, evaluationStatus: 'FAILED' },
      { id: 'd', agent: 'codex', startedAt: new Date(), score: null, evaluationStatus: 'SKIPPED' },
    ];
    const req = mockReq({
      query: {},
      user: { userId: 'user-1' },
      prisma: { session: { findMany: vi.fn().mockResolvedValue(rows) } },
    });
    const res = mockRes();

    await getRecentSessions(req, res);

    const statuses = (res.body as { sessions: { status: string }[] }).sessions.map((s) => s.status);
    expect(statuses).toEqual(['queued', 'scored', 'failed', 'skipped']);
  });
});
