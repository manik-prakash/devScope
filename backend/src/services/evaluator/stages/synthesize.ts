/**
 * Stage 5 — Synthesis (LLM).
 *
 * Generates summary, strength, improvement_focus, and optional trend +
 * anomaly notes from everything the previous stages produced. The numeric
 * overall_score is NOT generated here — it is computed in the orchestrator
 * before this stage runs and passed in for the model to ground its prose
 * around.
 *
 * On two failed LLM attempts, returns a mechanical fallback synthesis
 * derived from dimension scores with synthesis_failed = true.
 */

import { callLLMJson } from '../llm.js';
import { synthesisPrompt } from '../prompts.js';
import { SynthesisSchema } from '../schemas.js';
import type {
  Anomaly,
  ClassificationResult,
  DimensionScores,
  PipelineInput,
  Synthesis,
  TrendData,
} from '../types.js';

export interface SynthesizeInput {
  input:          PipelineInput;
  classification: ClassificationResult;
  anomalies:      Anomaly[];
  dimensions:     DimensionScores;
  trends:         TrendData;
  adjustedScore:  number;
}

export async function synthesize(args: SynthesizeInput): Promise<Synthesis> {
  const { system, user } = synthesisPrompt(args);

  const result = await callLLMJson({
    label:  'synthesis',
    system,
    user,
    schema: SynthesisSchema,
  });

  if (!result.ok) {
    return mechanicalFallback(args);
  }

  return {
    summary:           result.data.summary,
    strength:          result.data.strength,
    improvement_focus: result.data.improvement_focus,
    trend_observation: result.data.trend_observation,
    anomaly_notes:     result.data.anomaly_notes,
    synthesis_failed:  false,
  };
}

// ─── Mechanical fallback ─────────────────────────────────────────────────────

/**
 * Derive synthesis from dimension scores and anomalies when the LLM call
 * fails twice. Not pretty, but honest — every field cites real numbers and
 * the reader knows the LLM didn't write this.
 */
function mechanicalFallback(args: SynthesizeInput): Synthesis {
  const { classification, anomalies, dimensions } = args;
  const dims = [
    { name: 'prompt quality',       score: dimensions.prompt_quality,       reasoning: dimensions.prompt_quality_reasoning },
    { name: 'iteration efficiency', score: dimensions.iteration_efficiency, reasoning: dimensions.iteration_reasoning      },
    { name: 'tool utilization',     score: dimensions.tool_utilization,     reasoning: dimensions.tool_reasoning           },
  ] as const;

  const sortedDesc = [...dims].sort((a, b) => b.score - a.score);
  const strongest = sortedDesc[0] as (typeof dims)[number];
  const weakest   = sortedDesc[sortedDesc.length - 1] as (typeof dims)[number];

  const summary =
    `This was a ${classification.complexity}-complexity ${classification.task_type} session ` +
    `(pattern: ${classification.pattern}). ` +
    `Dimension scores — prompts: ${dimensions.prompt_quality}, ` +
    `iteration: ${dimensions.iteration_efficiency}, tools: ${dimensions.tool_utilization}.`;

  const strength =
    `Strongest dimension: ${strongest.name} at ${strongest.score}/100. ${strongest.reasoning}`;

  const improvementFocus =
    `Focus next session on ${weakest.name} (${weakest.score}/100). ${weakest.reasoning}`;

  const significant = anomalies.filter((a) => a.severity !== 'info');
  const anomalyNotes: string | null = significant.length > 0
    ? significant.map((a) => `${a.code}: ${a.detail}`).join(' ')
    : null;

  return {
    summary,
    strength,
    improvement_focus: improvementFocus,
    trend_observation: null,
    anomaly_notes:     anomalyNotes,
    synthesis_failed:  true,
  };
}
