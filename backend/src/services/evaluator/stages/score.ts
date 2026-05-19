/**
 * Stage 3 — Dimension scoring (LLM).
 *
 * Scores prompt_quality, iteration_efficiency, and tool_utilization (0-100
 * each) with a rubric that adapts to the Stage 1 classification. On two
 * failed LLM attempts, returns neutral 50s with dimension_scoring_failed=true.
 */

import { callLLMJson } from '../llm.js';
import { dimensionScoringPrompt } from '../prompts.js';
import { DimensionScoresSchema } from '../schemas.js';
import type { ClassificationResult, DimensionScores, PipelineInput } from '../types.js';

export const NEUTRAL_DIMENSION_SCORES: DimensionScores = {
  prompt_quality:           50,
  prompt_quality_reasoning: '(scoring failed; neutral default applied)',
  iteration_efficiency:     50,
  iteration_reasoning:      '(scoring failed; neutral default applied)',
  tool_utilization:         50,
  tool_reasoning:           '(scoring failed; neutral default applied)',
  dimension_scoring_failed: true,
};

export async function scoreDimensions(
  input: PipelineInput,
  classification: ClassificationResult,
): Promise<DimensionScores> {
  const { system, user } = dimensionScoringPrompt(input, classification);

  const result = await callLLMJson({
    label:  'dimension_scoring',
    system,
    user,
    schema: DimensionScoresSchema,
  });

  if (!result.ok) {
    return NEUTRAL_DIMENSION_SCORES;
  }

  return {
    prompt_quality:           result.data.prompt_quality,
    prompt_quality_reasoning: result.data.prompt_quality_reasoning,
    iteration_efficiency:     result.data.iteration_efficiency,
    iteration_reasoning:      result.data.iteration_reasoning,
    tool_utilization:         result.data.tool_utilization,
    tool_reasoning:           result.data.tool_reasoning,
    dimension_scoring_failed: false,
  };
}
