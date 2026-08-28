/**
 * All LLM prompts for the evaluation pipeline.
 *
 * Prompt builders are pure functions. They take typed pipeline data and emit
 * { system, user } pairs. The model is hardcoded here (not env-driven) so the
 * pipeline cannot accidentally be pointed at a paid model in production.
 */

import type {
  Anomaly,
  ClassificationResult,
  DimensionScores,
  PipelineInput,
  TrendData,
} from './types.js';

// ─── Model + shared suffix ───────────────────────────────────────────────────

/** The only model the pipeline talks to. Free tier, deterministic identifier. */
export const MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/** Suffix every system prompt ends with — non-negotiable shape contract. */
export const JSON_ONLY_SUFFIX =
  'Return only valid JSON. No markdown. No prose outside the JSON object.';

export interface PromptPair {
  system: string;
  user:   string;
}

// ─── Stage 1 — Classification ────────────────────────────────────────────────

/**
 * Build the classification prompt. The LLM gets:
 *   - the stats block
 *   - a redacted summary of messages (role + content_length only)
 *   - a redacted summary of tool calls (name + is_file_modifying + is_shell_command)
 * It receives no content, no tool inputs/outputs, no file paths.
 */
export function classificationPrompt(input: PipelineInput): PromptPair {
  const { stats, durationMs, messages } = input;

  const messageSummaries = messages.map((m) => ({
    role:           m.role,
    content_length: m.content_length,
  }));

  const toolCallSummaries = messages.flatMap((m) =>
    (m.tool_calls ?? []).map((tc) => ({
      name:              tc.name,
      is_file_modifying: tc.is_file_modifying,
      is_shell_command:  tc.is_shell_command,
    })),
  );

  const system = [
    'You are a session classifier for a developer telemetry product. You read behavioral statistics from an AI coding-agent session and decide what kind of work the developer was doing, how complex it was, and how they approached it.',
    '',
    'Pick exactly one value for each of three fields:',
    '',
    'task_type — what the developer was primarily doing:',
    '  "debugging"    — high shell command count, repeated iterations, few file types',
    '  "feature"      — multiple file types, mix of read and write tools, moderate iterations',
    '  "refactor"     — high file-modifying tool count, moderate prompts, multiple file types',
    '  "exploration"  — many short prompts, high response lengths, low file modification',
    '  "boilerplate"  — low iterations, high file write count, short session relative to output',
    '',
    'complexity — how hard the task appears to have been:',
    '  "low"     — short duration, few iterations, simple tool pattern',
    '  "medium"  — moderate duration, mixed tool usage',
    '  "high"    — long duration, many iterations, diverse tool calls, multiple file types',
    '',
    'pattern — how the developer approached the session:',
    '  "direct"       — few prompts, got result quickly, low iterations',
    '  "iterative"    — steady back and forth, consistent prompt lengths',
    '  "exploratory"  — many short prompts, trying different approaches',
    '  "stuck"        — high iterations with diminishing response lengths and many shell commands suggesting repeated failed attempts',
    '',
    'Respond with a JSON object of exactly this shape:',
    '{ "task_type": string, "complexity": string, "pattern": string, "reasoning": string }',
    'reasoning is one sentence (≤ 240 chars) citing the specific signals that drove your decision.',
    '',
    JSON_ONLY_SUFFIX,
  ].join('\n');

  const durationMinutes = Math.round((durationMs / 60_000) * 10) / 10;

  const user = JSON.stringify(
    {
      duration_minutes: durationMinutes,
      stats,
      messages:    messageSummaries,
      tool_calls:  toolCallSummaries,
    },
    null,
    2,
  );

  return { system, user };
}

// ─── Stage 5 — Synthesis ─────────────────────────────────────────────────────

export interface SynthesisPromptInput {
  input:          PipelineInput;
  classification: ClassificationResult;
  anomalies:      Anomaly[];
  dimensions:     DimensionScores;
  trends:         TrendData;
  adjustedScore:  number;
}

/**
 * Build the synthesis prompt. The model gets every prior stage's output plus
 * the code-computed adjusted_score. It must NOT produce a score — the schema
 * doesn't accept one. It only generates the narrative pieces.
 */
export function synthesisPrompt(args: SynthesisPromptInput): PromptPair {
  const { input, classification, anomalies, dimensions, trends, adjustedScore } = args;

  const flagCount    = anomalies.filter((a) => a.severity === 'flag').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;

  const system = [
    'You are the synthesis stage of a developer-analytics pipeline that has already classified the session, detected anomalies, scored three dimensions, and computed a trend signal. Your job is to write the human-readable feedback — a short summary, one strength, one improvement focus, and conditional trend / anomaly notes.',
    '',
    'Voice: a senior engineer giving a peer review. Honest, specific, never generic. Reference real numbers from the data — a score, a ratio, a count.',
    '',
    'Required fields:',
    '  summary           — 2-3 sentences, an honest overall read. Reference the task_type and complexity from classification. Do NOT repeat or mention the numeric overall score.',
    '  strength          — one specific thing the developer did well. MUST cite a real signal (a dimension score, a trend label, a stat). Not generic praise.',
    '  improvement_focus — one specific, actionable thing to work on next session. MUST be grounded in the LOWEST-scoring dimension and its reasoning.',
    '',
    'Optional fields:',
    '  trend_observation — set ONLY if trends are noteworthy (trajectory not "stable", or a streak is present, or score is volatile). Reference the actual trajectory and streak. Set to null otherwise.',
    '  anomaly_notes     — set ONLY if any "flag" or "warning" anomalies were detected. Explain what was flagged. Frame as a non-accusatory observation. Set to null otherwise.',
    '',
    'Respond with a JSON object of exactly this shape:',
    '{ "summary": string, "strength": string, "improvement_focus": string, "trend_observation": string | null, "anomaly_notes": string | null }',
    '',
    JSON_ONLY_SUFFIX,
  ].join('\n');

  const user = JSON.stringify(
    {
      classification: {
        task_type:  classification.task_type,
        complexity: classification.complexity,
        pattern:    classification.pattern,
        reasoning:  classification.reasoning,
      },
      anomalies: {
        flag_count:    flagCount,
        warning_count: warningCount,
        items:         anomalies, // include all so the LLM can name them in anomaly_notes
      },
      dimensions: {
        prompt_quality:           dimensions.prompt_quality,
        prompt_quality_reasoning: dimensions.prompt_quality_reasoning,
        iteration_efficiency:     dimensions.iteration_efficiency,
        iteration_reasoning:      dimensions.iteration_reasoning,
        tool_utilization:         dimensions.tool_utilization,
        tool_reasoning:           dimensions.tool_reasoning,
      },
      trends,
      score: {
        adjusted_score: adjustedScore,
        // Informational — explains the deduction the model is seeing.
        note: `${flagCount} flag(s) × 8 + ${warningCount} warning(s) × 3 were deducted from the base.`,
      },
      stats: {
        durationMinutes:    Math.round((input.durationMs / 60_000) * 10) / 10,
        totalIterations:    input.stats.totalIterations,
        totalToolCalls:     input.stats.totalToolCalls,
        avgPromptLength:    input.stats.avgPromptLength,
        avgResponseLength:  input.stats.avgResponseLength,
        filesChangedCount:  input.stats.filesChangedCount,
        shellCommandsCount: input.stats.shellCommandsCount,
        fileTypesTouched:   input.stats.fileTypesTouched,
      },
    },
    null,
    2,
  );

  return { system, user };
}

// ─── Stage 3 — Dimension scoring ─────────────────────────────────────────────

/**
 * Iterations per minute. Lower is generally better. Returned as a number so
 * we can show it to the LLM and the stage can label it for the orchestrator.
 */
export function computeIterationRatio(stats: PipelineInput['stats'], durationMs: number): number {
  const minutes = durationMs / 60_000;
  if (minutes <= 0) return 0;
  return stats.totalIterations / minutes;
}

/**
 * Build the dimension-scoring prompt. The full rubric (base bands +
 * classification-driven adjustments) is embedded in the system prompt so the
 * model has everything it needs to score consistently. The user message
 * carries the numeric signals and the Stage 1 classification.
 */
export function dimensionScoringPrompt(
  input: PipelineInput,
  classification: ClassificationResult,
): PromptPair {
  const { stats, durationMs } = input;
  const minutes = Math.max(durationMs / 60_000, 0);
  const iterationRatio = computeIterationRatio(stats, durationMs);
  const toolCallsPer5Min = minutes > 0 ? (stats.totalToolCalls / minutes) * 5 : 0;

  const system = [
    'You are a session-scoring engine for a developer-analytics product. Score the session along three dimensions on a 0-100 integer scale, then provide one specific reasoning sentence per dimension citing the actual numbers you used.',
    '',
    'The rubric below is authoritative. Stay inside the indicated bands. Apply the classification-driven adjustments before settling on a score.',
    '',
    '─── DIMENSION 1: prompt_quality (0-100) ───',
    'Measures whether prompts give the AI enough context to be useful.',
    '',
    'Base bands (by avgPromptLength):',
    '  >= 250 chars  → 80-100  (strong base)',
    '  150-249 chars → 55-79   (moderate base)',
    '  80-149 chars  → 30-54   (weak base)',
    '  < 80 chars    → 0-29    (poor base)',
    '',
    'Classification adjustments:',
    '  task_type "exploration"   → relax length requirement by 30% (short prompts are normal here)',
    '  task_type "debugging"     → increase length requirement by 20% (debugging needs more context)',
    '  pattern "stuck"           → heavily penalize short prompts (being stuck + short prompts = under-specifying)',
    '',
    '─── DIMENSION 2: iteration_efficiency (0-100) ───',
    'Measures how efficiently the developer reached their goal.',
    'Core signal: iterations per minute = totalIterations / (durationMs / 60000). Lower is better.',
    '',
    'Base bands (by iterations-per-minute):',
    '  < 0.5         → excellent (80-100)',
    '  0.5 - 1.0     → good      (60-79)',
    '  1.0 - 2.0     → moderate  (35-59)',
    '  > 2.0         → poor      (0-34)',
    '',
    'Hard floor: if totalIterations == 0 the session produced no measurable',
    'back-and-forth — score iteration_efficiency ≤ 15 regardless of the ratio.',
    '',
    'Classification adjustments (multiply allowed ratio):',
    '  complexity "high"          → allowed ratio × 2.0   (high complexity naturally needs more iterations)',
    '  complexity "low"           → allowed ratio × 0.6   (low complexity should need very few iterations)',
    '  task_type "debugging"      → allowed ratio × 1.5   (debugging is inherently iterative)',
    '  task_type "boilerplate"    → allowed ratio × 0.5   (boilerplate should be fast and direct)',
    '  pattern "stuck"            → cap score at 45 regardless of ratio',
    '',
    '─── DIMENSION 3: tool_utilization (0-100) ───',
    'Measures whether the AI was used effectively across the codebase. Active, diverse usage = high score; shallow = low.',
    'Signals: fileTypes.length (diversity), toolCallsPer5Min (active usage rate), filesChangedCount (output), shellCommandsCount (execution).',
    '',
    'Base bands:',
    '  fileTypes >= 3 AND toolCallsPer5Min >= 1 → high   (75-100)',
    '  fileTypes == 2 OR moderate toolCallsPer5Min (0.5-1) → medium (45-74)',
    '  fileTypes == 1 AND low toolCallsPer5Min  → low    (0-44)',
    '',
    'Classification adjustments:',
    '  task_type "exploration"   → reduce file-diversity requirement (touching fewer files is legitimate)',
    '  task_type "refactor"      → increase weight of filesChangedCount (refactoring should produce many file changes)',
    '  task_type "debugging"     → increase weight of shellCommandsCount (debugging involves running code frequently)',
    '',
    '─── OUTPUT SHAPE ───',
    'Respond with a JSON object of exactly this shape:',
    '{',
    '  "prompt_quality": integer 0-100,',
    '  "prompt_quality_reasoning": one sentence citing the specific avgPromptLength used and any classification adjustment applied,',
    '  "iteration_efficiency": integer 0-100,',
    '  "iteration_reasoning": one sentence citing the iterations-per-minute ratio and any classification adjustment applied,',
    '  "tool_utilization": integer 0-100,',
    '  "tool_reasoning": one sentence citing fileTypes.length, toolCallsPer5Min, and any classification adjustment applied',
    '}',
    'Each reasoning sentence ≤ 240 chars and MUST cite at least one specific number from the input.',
    '',
    JSON_ONLY_SUFFIX,
  ].join('\n');

  const user = JSON.stringify(
    {
      classification: {
        task_type:  classification.task_type,
        complexity: classification.complexity,
        pattern:    classification.pattern,
      },
      signals: {
        avgPromptLength:     stats.avgPromptLength,
        avgResponseLength:   stats.avgResponseLength,
        totalIterations:     stats.totalIterations,
        totalToolCalls:      stats.totalToolCalls,
        filesChangedCount:   stats.filesChangedCount,
        shellCommandsCount:  stats.shellCommandsCount,
        fileTypesTouched:    stats.fileTypesTouched,
        durationMinutes:     Math.round(minutes * 10) / 10,
        iterationsPerMinute: Math.round(iterationRatio * 100) / 100,
        toolCallsPer5Min:    Math.round(toolCallsPer5Min * 100) / 100,
      },
    },
    null,
    2,
  );

  return { system, user };
}
