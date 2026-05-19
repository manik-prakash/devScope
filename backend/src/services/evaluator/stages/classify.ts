/**
 * Stage 1 — Classification (LLM).
 *
 * Determines task_type, complexity, and pattern from session stats + redacted
 * message/tool-call summaries. On two failed LLM attempts, returns the spec's
 * default classification with classification_failed = true.
 */

import { callLLMJson } from '../llm.js';
import { classificationPrompt } from '../prompts.js';
import { ClassificationSchema } from '../schemas.js';
import type { ClassificationResult, PipelineInput } from '../types.js';

export const CLASSIFICATION_DEFAULTS: ClassificationResult = {
  task_type:             'feature',
  complexity:            'medium',
  pattern:               'iterative',
  reasoning:             '(classification failed; using defaults)',
  classification_failed: true,
};

export async function classify(input: PipelineInput): Promise<ClassificationResult> {
  const { system, user } = classificationPrompt(input);

  const result = await callLLMJson({
    label:  'classification',
    system,
    user,
    schema: ClassificationSchema,
  });

  if (!result.ok) {
    return CLASSIFICATION_DEFAULTS;
  }

  return {
    task_type:             result.data.task_type,
    complexity:            result.data.complexity,
    pattern:               result.data.pattern,
    reasoning:             result.data.reasoning,
    classification_failed: false,
  };
}
