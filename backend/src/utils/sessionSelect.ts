import { Prisma } from '@prisma/client';

/**
 * The real per-dimension evaluator output, for inclusion on session list and
 * detail responses so the frontend can show actual scores instead of a
 * stats-derived heuristic. Null for legacy / unsigned / unscored sessions.
 */
export const scoreDetailInclude = {
  scoreDetail: {
    select: {
      promptQuality: true,
      iterationEfficiency: true,
      toolUtilization: true,
      overallScore: true,
      confidence: true,
    },
  },
} satisfies Prisma.SessionInclude;
