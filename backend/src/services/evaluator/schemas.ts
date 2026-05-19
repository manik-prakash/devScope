/**
 * Zod schemas for the three LLM-driven stages.
 *
 * Each schema validates the JSON object returned by the model after markdown
 * fence stripping. callLLMJson (llm.ts) pipes parsed JSON through one of these
 * before handing it back to the stage.
 */

import { z } from 'zod';

// ─── Stage 1 — Classification ────────────────────────────────────────────────

export const ClassificationSchema = z.object({
  task_type:  z.enum(['debugging', 'feature', 'refactor', 'exploration', 'boilerplate']),
  complexity: z.enum(['low', 'medium', 'high']),
  pattern:    z.enum(['direct', 'iterative', 'exploratory', 'stuck']),
  reasoning:  z.string().min(1).max(500),
});

export type ClassificationParsed = z.infer<typeof ClassificationSchema>;

// ─── Stage 3 — Dimension scoring ─────────────────────────────────────────────

const Score = z.number().int().min(0).max(100);
const Reasoning = z.string().min(1).max(500);

export const DimensionScoresSchema = z.object({
  prompt_quality:            Score,
  prompt_quality_reasoning:  Reasoning,
  iteration_efficiency:      Score,
  iteration_reasoning:       Reasoning,
  tool_utilization:          Score,
  tool_reasoning:            Reasoning,
});

export type DimensionScoresParsed = z.infer<typeof DimensionScoresSchema>;

// ─── Stage 5 — Synthesis ─────────────────────────────────────────────────────

/**
 * LLMs occasionally emit "" or "null" instead of JSON null. Normalize them all
 * to `null` so the orchestrator can branch on a single value.
 */
const NullableNarrative = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v === null) return null;
    const trimmed = v.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
    return trimmed;
  });

export const SynthesisSchema = z.object({
  summary:           z.string().min(1).max(800),
  strength:          z.string().min(1).max(500),
  improvement_focus: z.string().min(1).max(500),
  trend_observation: NullableNarrative,
  anomaly_notes:     NullableNarrative,
});

export type SynthesisParsed = z.infer<typeof SynthesisSchema>;
