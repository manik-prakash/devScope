/**
 * Shared types for the multi-stage session evaluation pipeline.
 *
 * The orchestrator (index.ts) reshapes the raw Session row into a PipelineInput
 * once, then threads stage outputs forward via the typed structures below.
 */

// ─── Anomaly types (Stage 2) ─────────────────────────────────────────────────

export type AnomalySeverity = 'info' | 'warning' | 'flag';

export interface Anomaly {
  code:     string;
  severity: AnomalySeverity;
  detail:   string;
}

// ─── Classification types (Stage 1) ──────────────────────────────────────────

export type TaskType   = 'debugging' | 'feature' | 'refactor' | 'exploration' | 'boilerplate';
export type Complexity = 'low' | 'medium' | 'high';
export type Pattern    = 'direct' | 'iterative' | 'exploratory' | 'stuck';

export interface ClassificationResult {
  task_type:             TaskType;
  complexity:            Complexity;
  pattern:               Pattern;
  reasoning:             string;
  classification_failed: boolean;
}

// ─── Dimension scoring types (Stage 3) ───────────────────────────────────────

export interface DimensionScores {
  prompt_quality:            number; // 0-100
  prompt_quality_reasoning:  string;
  iteration_efficiency:      number; // 0-100
  iteration_reasoning:       string;
  tool_utilization:          number; // 0-100
  tool_reasoning:            string;
  dimension_scoring_failed:  boolean;
}

// ─── Trend types (Stage 4) ───────────────────────────────────────────────────

export type ScoreTrajectory   = 'improving' | 'declining' | 'stable' | 'volatile';
export type PromptLengthTrend = 'increasing' | 'decreasing' | 'stable';
export type IterationTrend    = 'improving' | 'worsening' | 'stable';

export interface TrendData {
  score_trajectory:     ScoreTrajectory   | null;
  prompt_length_trend:  PromptLengthTrend | null;
  iteration_trend:      IterationTrend    | null;
  consistency_score:    number            | null;
  streak:               { count: number; direction: ScoreTrajectory } | null;
  best_score_last_10:   number            | null;
  avg_score_last_10:    number            | null;
  new_file_types:       string[];
  insufficient_history: boolean;
}

/**
 * A historical session in the shape the trend stage consumes. The orchestrator
 * builds these by joining SessionScore with its parent Session.stats before the
 * pipeline starts, so trend logic stays pure (no DB access inside stages).
 */
export interface HistoricalSession {
  overallScore:     number;
  avgPromptLength:  number;
  /** totalIterations / (durationMs / 60000) */
  iterationRatio:   number;
  fileTypesTouched: string[];
}

// ─── Synthesis types (Stage 5) ───────────────────────────────────────────────

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Synthesis {
  summary:           string;
  strength:          string;
  improvement_focus: string;
  trend_observation: string | null;
  anomaly_notes:     string | null;
  synthesis_failed:  boolean;
}

// ─── Pipeline input ──────────────────────────────────────────────────────────

/** Subset of SessionStats the pipeline operates on. Mirrors the CLI's payload. */
export interface SessionStats {
  totalPrompts:       number;
  totalResponses:     number;
  totalIterations:    number;
  totalToolCalls:     number;
  filesChangedCount:  number;
  shellCommandsCount: number;
  avgPromptLength:    number;
  avgResponseLength:  number;
  fileTypesTouched:   string[];
}

export interface PipelineMessage {
  role:           string;
  content_length: number;
  tool_calls?:    Array<{
    name:              string;
    is_file_modifying: boolean;
    is_shell_command:  boolean;
  }>;
}

/** Shaped input the orchestrator hands to every stage. */
export interface PipelineInput {
  /** Session.durationMs converted from BigInt to number (clamped to safe integer). */
  durationMs: number;
  stats:      SessionStats;
  messages:   PipelineMessage[];
}

// ─── LLM helper result ───────────────────────────────────────────────────────

export type LLMResult<T> =
  | { ok: true;  data: T }
  | { ok: false; reason: string };
