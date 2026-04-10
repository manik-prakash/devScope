import { type Request, type Response } from 'express';
import { z } from 'zod';
import { verifySignature } from '../../utils/crypto.js';
import { forbidden } from '../../utils/errors.js';
import { evaluateSession } from '../../services/evaluator.js';

const SessionPayloadSchema = z.object({
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

export const getMe = async (req: Request, res: Response) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      projectMembers: {
        include: { project: true }
      }
    }
  });

  if (!user) throw forbidden('User not found');

  const projects = user.projectMembers.map(m => ({
    id: m.project.id,
    slug: m.project.slug,
    name: m.project.name,
  }));

  res.json({
    user_id: user.id,
    org_id: user.orgId,
    name: user.name,
    email: user.email,
    projects,
    default_project_slug: projects[0]?.slug || '',
    signing_secret: req.apiKey!.signingSecret,
  });
};

export const createSession = async (req: Request, res: Response) => {
  const payload = SessionPayloadSchema.parse(req.body);

  // Identity alignment
  if (payload.user_id !== req.user!.userId) {
    throw forbidden('User ID mismatch');
  }
  if (payload.org_id !== req.apiKey!.orgId) {
    throw forbidden('Organization ID mismatch');
  }

  // Signature verification
  const signatureValid = verifySignature(payload, req.apiKey!.signingSecret);

  // Project membership check
  const membership = await req.prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: payload.project_id,
        userId: payload.user_id,
      }
    }
  });

  if (!membership) {
    throw forbidden('User is not a member of this project');
  }

  // Upsert session
  const session = await req.prisma.session.upsert({
    where: { id: payload.session_id },
    create: {
      id: payload.session_id,
      userId: payload.user_id,
      orgId: payload.org_id,
      projectId: payload.project_id,
      apiKeyId: req.apiKey!.id,
      agent: payload.agent,
      agentVersion: payload.agent_version,
      startedAt: new Date(payload.started_at),
      endedAt: new Date(payload.ended_at),
      durationMs: BigInt(payload.duration_ms),
      cliVersion: payload.cli_version,
      messages: payload.messages || [],
      stats: payload.stats,
      signatureValid,
      evaluationStatus: signatureValid ? 'PENDING' : 'SKIPPED',
    },
    update: {}, // sessions are immutable once sent from CLI
  });

  if (signatureValid) {
    // Fire and forget evaluation
    evaluateSession(session.id).catch(err => 
      console.error(`Evaluation failed for ${session.id}:`, err)
    );
  }

  res.status(202).json({ session_id: session.id });
};

export const getRecentSessions = async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const clampedLimit = Math.min(Math.max(limit, 1), 50);

  const sessions = await req.prisma.session.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: clampedLimit,
    select: {
      id: true,
      agent: true,
      startedAt: true,
      score: true,
      evaluationStatus: true,
    }
  });

  res.json({
    sessions: sessions.map(s => ({
      session_id: s.id,
      agent: s.agent,
      started_at: s.startedAt,
      score: s.score,
      status: s.evaluationStatus,
    }))
  });
};
