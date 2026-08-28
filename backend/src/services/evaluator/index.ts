/**
 * Multi-stage session evaluation pipeline — orchestrator entry point.
 *
 * Runs five stages in order:
 *
 *   Stage 1 — classify           (LLM, with retry + Zod + default fallback)
 *   Stage 2 — detectAnomalies    (pure, 8 deterministic rules)
 *   Stage 3 — scoreDimensions    (LLM, with retry + Zod + neutral fallback)
 *           — compute adjusted_score in code
 *   Stage 4 — analyzeTrends      (pure, over last 10 SessionScore rows)
 *   Stage 5 — synthesize         (LLM, generates narrative only; mechanical fallback)
 *
 * Writes a SessionScore row and mirrors the headline values back onto the
 * parent Session (score / feedback / evaluationStatus / evaluatedAt) for
 * compatibility with existing frontend reads.
 *
 * Never throws. Catches its own Prisma errors and logs them — the caller in
 * controllers/cli.ts will already have replied 202 to the CLI before this
 * point in a worst-case scenario, but we keep it safe regardless.
 */

import { prisma } from '../../config/prisma.js';
import { MODEL, computeIterationRatio } from './prompts.js';
import { classify } from './stages/classify.js';
import { detectAnomalies } from './stages/anomalies.js';
import { scoreDimensions } from './stages/score.js';
import { analyzeTrends } from './stages/trends.js';
import { synthesize } from './stages/synthesize.js';
import type {
  Anomaly,
  Confidence,
  HistoricalSession,
  PipelineInput,
  PipelineMessage,
  SessionStats,
} from './types.js';

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function evaluatePipeline(sessionId: string): Promise<void> {
  try {
    await runPipeline(sessionId);
  } catch (err) {
    console.error(`[evaluator] pipeline crashed for session ${sessionId}:`, err);
    // Best-effort: mark Session as FAILED so the UI doesn't show "Evaluating…" forever.
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data:  { evaluationStatus: 'FAILED', evaluatedAt: new Date() },
      });
    } catch (innerErr) {
      console.error(`[evaluator] failed to mark session ${sessionId} as FAILED:`, innerErr);
    }
  }
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function runPipeline(sessionId: string): Promise<void> {
  // 1. Load the session itself.
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id:              true,
      userId:          true,
      orgId:           true,
      durationMs:      true,
      signatureValid:  true,
      stats:           true,
      messages:        true,
    },
  });

  if (!session) {
    console.warn(`[evaluator] session ${sessionId} not found; skipping pipeline`);
    return;
  }

  // 2. Sessions with invalid signatures are never scored.
  if (!session.signatureValid) {
    await prisma.session.update({
      where: { id: sessionId },
      data:  { evaluationStatus: 'SKIPPED', evaluatedAt: new Date() },
    });
    return;
  }

  // 3. Reshape into PipelineInput.
  const input: PipelineInput = {
    durationMs: bigIntToNumber(session.durationMs),
    stats:      readStats(session.stats),
    messages:   readMessages(session.messages),
  };

  // 4. Fetch developer's last 10 prior scored sessions (with their stats + durationMs).
  const history = await loadHistory(session.userId, sessionId);

  // 5-9. Stages 1-3 + score computation.
  const classification = await classify(input);
  const anomalies      = detectAnomalies(input, classification);
  const dimensions     = await scoreDimensions(input, classification);

  const baseScore =
    dimensions.prompt_quality       * 0.40 +
    dimensions.iteration_efficiency * 0.40 +
    dimensions.tool_utilization     * 0.20;

  const flagCount    = anomalies.filter((a) => a.severity === 'flag').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;
  const deduction    = flagCount * 8 + warningCount * 3;

  const adjustedScore = round1(Math.max(5, baseScore - deduction));

  // 10. Stage 4 — trend analysis.
  const trends = analyzeTrends({
    currentAdjustedScore:   adjustedScore,
    currentAvgPromptLength: input.stats.avgPromptLength,
    currentIterationRatio:  computeIterationRatio(input.stats, input.durationMs),
    currentFileTypes:       input.stats.fileTypesTouched,
    history,
  });

  // 11. Stage 5 — synthesis.
  const synthesis = await synthesize({
    input,
    classification,
    anomalies,
    dimensions,
    trends,
    adjustedScore,
  });

  // 12. Confidence + failure roll-up.
  const failures =
    Number(classification.classification_failed) +
    Number(dimensions.dimension_scoring_failed) +
    Number(synthesis.synthesis_failed);

  const confidence: Confidence = (() => {
    if (failures === 0 && history.length >= 10) return 'HIGH';
    if (classification.classification_failed || failures >= 2) return 'LOW';
    return 'MEDIUM';
  })();

  const evaluationFailed =
    classification.classification_failed &&
    dimensions.dimension_scoring_failed &&
    synthesis.synthesis_failed;

  const failureReason = evaluationFailed
    ? `All three LLM stages failed: classification, dimension scoring, synthesis`
    : buildFailureReasonPartial(classification.classification_failed, dimensions.dimension_scoring_failed, synthesis.synthesis_failed);

  // 13. Persist — SessionScore + mirrored legacy fields on Session, transactionally.
  const sessionScoreData = {
    userId:              session.userId,
    orgId:               session.orgId,
    promptQuality:       dimensions.prompt_quality,
    iterationEfficiency: dimensions.iteration_efficiency,
    toolUtilization:     dimensions.tool_utilization,
    overallScore:        adjustedScore,
    confidence,
    summary:             synthesis.summary,
    strength:            synthesis.strength,
    improvementFocus:    synthesis.improvement_focus,
    trendObservation:    synthesis.trend_observation,
    anomalyNotes:        synthesis.anomaly_notes,
    anomalies:           anomalies as unknown as object,
    classification:      classificationForStorage(classification),
    trends:              trends as unknown as object,
    evaluationFailed,
    failureReason,
    modelUsed:           MODEL,
    evaluatedAt:         new Date(),
  };

  const legacyFeedback = {
    summary:      synthesis.summary,
    strengths:    [synthesis.strength],
    improvements: [synthesis.improvement_focus],
  };

  await prisma.$transaction([
    prisma.sessionScore.upsert({
      where:  { sessionId },
      update: sessionScoreData,
      create: { sessionId, ...sessionScoreData },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data:  {
        evaluationStatus: evaluationFailed ? 'FAILED' : 'SCORED',
        score:            adjustedScore,
        feedback:         legacyFeedback,
        evaluatedAt:      new Date(),
      },
    }),
  ]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function loadHistory(userId: string, currentSessionId: string): Promise<HistoricalSession[]> {
  const rows = await prisma.sessionScore.findMany({
    where: {
      userId,
      sessionId: { not: currentSessionId },
      // Fallback-only evaluations (all three LLM stages failed) carry neutral
      // placeholder scores — they'd distort the trend signal and the
      // "HIGH confidence needs 10 prior sessions" gate.
      evaluationFailed: false,
    },
    orderBy: { evaluatedAt: 'desc' },
    take:    10,
    select: {
      overallScore: true,
      session: {
        select: {
          durationMs: true,
          stats:      true,
        },
      },
    },
  });

  return rows.map((row) => {
    const stats = readStats(row.session.stats);
    const durationMs = bigIntToNumber(row.session.durationMs);
    return {
      overallScore:     row.overallScore,
      avgPromptLength:  stats.avgPromptLength,
      iterationRatio:   computeIterationRatio(stats, durationMs),
      fileTypesTouched: stats.fileTypesTouched,
    };
  });
}

function bigIntToNumber(value: bigint): number {
  // Session durations live well within Number.MAX_SAFE_INTEGER (~285k years in ms).
  // The guard is defensive only.
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  if (value < 0n) return 0;
  return Number(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Convert the classification result into the shape we store as JSON. Keeps
 * the failure flag so historical rows are introspectable.
 */
function classificationForStorage(c: PipelineInput extends never ? never : Awaited<ReturnType<typeof classify>>): object {
  return {
    task_type:             c.task_type,
    complexity:            c.complexity,
    pattern:               c.pattern,
    reasoning:             c.reasoning,
    classification_failed: c.classification_failed,
  };
}

function buildFailureReasonPartial(
  classificationFailed: boolean,
  dimensionFailed: boolean,
  synthesisFailed: boolean,
): string | null {
  const parts: string[] = [];
  if (classificationFailed) parts.push('classification');
  if (dimensionFailed)      parts.push('dimension scoring');
  if (synthesisFailed)      parts.push('synthesis');
  if (parts.length === 0)   return null;
  return `Stage(s) used fallback: ${parts.join(', ')}`;
}

// ─── Stats / Messages — defensive JSON readers ──────────────────────────────

function readStats(json: unknown): SessionStats {
  const obj = (json && typeof json === 'object' && !Array.isArray(json))
    ? (json as Record<string, unknown>)
    : {};

  return {
    totalPrompts:       numberOr(obj['totalPrompts'],       0),
    totalResponses:     numberOr(obj['totalResponses'],     0),
    totalIterations:    numberOr(obj['totalIterations'],    0),
    totalToolCalls:     numberOr(obj['totalToolCalls'],     0),
    filesChangedCount:  numberOr(obj['filesChangedCount'],  0),
    shellCommandsCount: numberOr(obj['shellCommandsCount'], 0),
    avgPromptLength:    numberOr(obj['avgPromptLength'],    0),
    avgResponseLength:  numberOr(obj['avgResponseLength'],  0),
    fileTypesTouched:   stringArrayOr(obj['fileTypesTouched'], []),
  };
}

function readMessages(json: unknown): PipelineMessage[] {
  if (!Array.isArray(json)) return [];
  return json.map((raw): PipelineMessage => {
    const m = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    return {
      role:           stringOr(m['role'], ''),
      content_length: numberOr(m['content_length'], 0),
      tool_calls: Array.isArray(m['tool_calls'])
        ? (m['tool_calls'] as Array<Record<string, unknown>>).map((tc) => ({
            name:              stringOr(tc['name'], ''),
            is_file_modifying: Boolean(tc['is_file_modifying']),
            is_shell_command:  Boolean(tc['is_shell_command']),
          }))
        : undefined,
    };
  });
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((v): v is string => typeof v === 'string');
}
