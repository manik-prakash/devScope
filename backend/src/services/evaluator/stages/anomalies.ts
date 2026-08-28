/**
 * Stage 2 — Anomaly detection (pure compute, no LLM).
 *
 * Applies eight deterministic rules to flag suspicious or unusual session
 * patterns. The orchestrator translates the returned anomaly list into a
 * score deduction in Stage 5 (flag × 8, warning × 3, info × 0).
 *
 * COMPLEXITY_MISMATCH depends on the Stage 1 classification — that's why this
 * stage runs after Stage 1 even though it is otherwise data-driven.
 */

import type { Anomaly, ClassificationResult, PipelineInput } from '../types.js';

// ─── Thresholds (named so the rules read like the spec) ──────────────────────

const TWO_MINUTES_MS    =   2 * 60_000;
const TWENTY_MINUTES_MS =  20 * 60_000;
const THIRTY_MINUTES_MS =  30 * 60_000;
const FORTY_FIVE_MINUTES_MS = 45 * 60_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Population standard deviation. Returns null when the sample is too small to
 * be meaningful (n < 2) so callers can skip the rule rather than treat the
 * single-sample zero as a positive trigger.
 */
function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function userMessageLengths(input: PipelineInput): number[] {
  return input.messages
    .filter((m) => m.role === 'user' || m.role === 'human')
    .map((m) => m.content_length);
}

// ─── detectAnomalies ─────────────────────────────────────────────────────────

export function detectAnomalies(
  input: PipelineInput,
  classification: ClassificationResult,
): Anomaly[] {
  const { durationMs, stats } = input;
  const anomalies: Anomaly[] = [];

  // ZERO_ITERATIONS (flag)
  if (stats.totalIterations === 0) {
    anomalies.push({
      code:     'ZERO_ITERATIONS',
      severity: 'flag',
      detail:   'No conversation turns recorded — statistically improbable for a real session.',
    });
  }

  // SUSPICIOUSLY_PERFECT (flag)
  if (
    stats.totalIterations <= 2 &&
    durationMs > THIRTY_MINUTES_MS &&
    stats.filesChangedCount > 5
  ) {
    anomalies.push({
      code:     'SUSPICIOUSLY_PERFECT',
      severity: 'flag',
      detail:   'Very few iterations for a long session with many file changes — pattern inconsistent with normal agent usage.',
    });
  }

  // COPY_PASTE_PATTERN (warning)
  const promptLenStddev = stddev(userMessageLengths(input));
  if (promptLenStddev !== null && promptLenStddev < 10) {
    anomalies.push({
      code:     'COPY_PASTE_PATTERN',
      severity: 'warning',
      detail:   'All prompts are nearly identical in length — may indicate templated or copy-pasted prompts rather than genuine natural language interaction.',
    });
  }

  // NO_TOOL_CALLS_LONG_SESSION (warning)
  if (stats.totalToolCalls === 0 && durationMs > TWENTY_MINUTES_MS) {
    anomalies.push({
      code:     'NO_TOOL_CALLS_LONG_SESSION',
      severity: 'warning',
      detail:   'No tool calls recorded in a long session — agent may not have been actively used for code work.',
    });
  }

  // SHORT_BURST_HIGH_ACTIVITY (flag)
  if (durationMs < TWO_MINUTES_MS && stats.totalToolCalls > 10) {
    anomalies.push({
      code:     'SHORT_BURST_HIGH_ACTIVITY',
      severity: 'flag',
      detail:   'Extremely high tool call count for a very short session — timing inconsistent with normal usage.',
    });
  }

  // SHELL_HEAVY (info)
  if (
    stats.totalToolCalls > 0 &&
    stats.shellCommandsCount > stats.totalToolCalls * 0.75
  ) {
    anomalies.push({
      code:     'SHELL_HEAVY',
      severity: 'info',
      detail:   'Session was primarily shell command execution — developer may be using AI mainly to run code rather than write it.',
    });
  }

  // SINGLE_FILE_TYPE_LONG (info)
  if (stats.fileTypesTouched.length === 1 && durationMs > FORTY_FIVE_MINUTES_MS) {
    anomalies.push({
      code:     'SINGLE_FILE_TYPE_LONG',
      severity: 'info',
      detail:   'Long session touching only one file type — may indicate narrow or repetitive usage.',
    });
  }

  // COMPLEXITY_MISMATCH (warning) — reads Stage 1 classification
  if (classification.complexity === 'low' && stats.totalIterations > 15) {
    anomalies.push({
      code:     'COMPLEXITY_MISMATCH',
      severity: 'warning',
      detail:   'High iteration count for what appears to be a low complexity task — prompts may lack specificity.',
    });
  }

  // HIGH_RESPONSE_LOW_PROMPT (info)
  if (
    stats.avgPromptLength > 0 &&
    stats.avgResponseLength > stats.avgPromptLength * 10
  ) {
    anomalies.push({
      code:     'HIGH_RESPONSE_LOW_PROMPT',
      severity: 'info',
      detail:   'Very short prompts generating very long responses — developer may be under-specifying and relying heavily on the model to fill in context.',
    });
  }

  return anomalies;
}
