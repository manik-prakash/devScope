/**
 * Stage 4 — Trend analysis (pure compute, no LLM).
 *
 * Compares the current session against the developer's recent history (max
 * 10 sessions, newest-first) to produce trajectory signals for Stage 5.
 *
 * If fewer than 3 historical sessions are available, returns EMPTY_TRENDS
 * (insufficient_history = true). Individual fields that need more samples
 * than are available degrade gracefully to null rather than failing.
 */

import type {
  HistoricalSession,
  IterationTrend,
  PromptLengthTrend,
  ScoreTrajectory,
  TrendData,
} from '../types.js';

// ─── Thresholds ──────────────────────────────────────────────────────────────

const SCORE_DELTA_THRESHOLD     = 5;    // points: improving/declining cutoff
const VOLATILITY_STDDEV_THRESH  = 20;   // points: last-5 stddev → "volatile"
const RATIO_PCT_THRESHOLD       = 0.15; // 15%: prompt/iteration trend cutoff
const MIN_HISTORY_FOR_TRENDS    = 3;    // below this → EMPTY_TRENDS
const MIN_HISTORY_FOR_TRAJ      = 3;    // last-3 avg required for trajectory
const VOLATILITY_WINDOW         = 5;    // last-5 stddev for volatility
const PROMPT_ITER_WINDOW        = 5;    // last-5 avg for prompt/iteration trends

// ─── Public ──────────────────────────────────────────────────────────────────

export interface TrendInput {
  currentAdjustedScore:    number;
  currentAvgPromptLength:  number;
  currentIterationRatio:   number;
  currentFileTypes:        string[];
  /** Newest-first list of up to 10 prior sessions (excluding the current one). */
  history:                 HistoricalSession[];
}

export const EMPTY_TRENDS: TrendData = {
  score_trajectory:     null,
  prompt_length_trend:  null,
  iteration_trend:      null,
  consistency_score:    null,
  streak:               null,
  best_score_last_10:   null,
  avg_score_last_10:    null,
  new_file_types:       [],
  insufficient_history: true,
};

export function analyzeTrends(input: TrendInput): TrendData {
  const { history, currentAdjustedScore, currentAvgPromptLength, currentIterationRatio, currentFileTypes } = input;

  if (history.length < MIN_HISTORY_FOR_TRENDS) {
    // Even when we can't produce trends, surface the new_file_types diff —
    // a fresh session may legitimately touch types absent from a tiny history.
    return {
      ...EMPTY_TRENDS,
      new_file_types: computeNewFileTypes(currentFileTypes, history),
    };
  }

  const historyScores = history.map((h) => h.overallScore);
  const last3Scores   = historyScores.slice(0, 3);
  const last5Scores   = historyScores.slice(0, VOLATILITY_WINDOW);
  const last10Scores  = historyScores.slice(0, 10);

  // ── score_trajectory ────────────────────────────────────────────────────
  const last3Avg = mean(last3Scores);
  const last5StdDev = stddev(last5Scores);
  const scoreTrajectory: ScoreTrajectory = (() => {
    // Volatility override takes precedence — see spec.
    if (last5Scores.length >= VOLATILITY_WINDOW && last5StdDev !== null && last5StdDev > VOLATILITY_STDDEV_THRESH) {
      return 'volatile';
    }
    if (currentAdjustedScore > last3Avg + SCORE_DELTA_THRESHOLD) return 'improving';
    if (currentAdjustedScore < last3Avg - SCORE_DELTA_THRESHOLD) return 'declining';
    return 'stable';
  })();

  // ── prompt_length_trend ─────────────────────────────────────────────────
  const lastNPromptLengths = history.slice(0, PROMPT_ITER_WINDOW).map((h) => h.avgPromptLength);
  const promptLengthTrend = directionByPctThreshold(
    currentAvgPromptLength,
    mean(lastNPromptLengths),
    RATIO_PCT_THRESHOLD,
    'increasing',
    'decreasing',
  );

  // ── iteration_trend (semantics inverted: lower ratio = improving) ───────
  const lastNRatios = history.slice(0, PROMPT_ITER_WINDOW).map((h) => h.iterationRatio);
  const iterationTrendRaw = directionByPctThreshold(
    currentIterationRatio,
    mean(lastNRatios),
    RATIO_PCT_THRESHOLD,
    'worsening',  // ratio increased
    'improving',  // ratio decreased
  );
  const iterationTrend: IterationTrend = iterationTrendRaw;

  // ── consistency_score ───────────────────────────────────────────────────
  const last10StdDev = stddev(last10Scores);
  const consistencyScore = last10StdDev === null ? null : clamp(100 - last10StdDev, 0, 100);

  // ── streak ──────────────────────────────────────────────────────────────
  const streak = computeStreak(scoreTrajectory, historyScores);

  // ── best/avg over last 10 ───────────────────────────────────────────────
  const bestScoreLast10 = last10Scores.length > 0 ? Math.max(...last10Scores) : null;
  const avgScoreLast10  = last10Scores.length > 0 ? round1(mean(last10Scores))  : null;

  // ── new_file_types ──────────────────────────────────────────────────────
  const newFileTypes = computeNewFileTypes(currentFileTypes, history);

  return {
    score_trajectory:     scoreTrajectory,
    prompt_length_trend:  promptLengthTrend,
    iteration_trend:      iterationTrend,
    consistency_score:    consistencyScore === null ? null : round1(consistencyScore),
    streak,
    best_score_last_10:   bestScoreLast10,
    avg_score_last_10:    avgScoreLast10,
    new_file_types:       newFileTypes,
    insufficient_history: false,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Population standard deviation. Returns null when n < 2 so a single-sample
 * window doesn't masquerade as "perfectly consistent".
 */
function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Generic "is current more than X% above/below the baseline" classifier.
 * Returns `stable` when within the threshold OR when there is no baseline.
 */
function directionByPctThreshold<Up extends string, Down extends string>(
  current:  number,
  baseline: number,
  pct:      number,
  upLabel:   Up,
  downLabel: Down,
): Up | Down | 'stable' {
  if (baseline <= 0) return 'stable';
  const high = baseline * (1 + pct);
  const low  = baseline * (1 - pct);
  if (current > high) return upLabel;
  if (current < low)  return downLabel;
  return 'stable';
}

/**
 * Walk newest→older through history computing each session's trajectory
 * against its own preceding-3 average, and count how many in a row match
 * the current trajectory direction. Returns null when the current
 * trajectory is "volatile" (not a direction) or when no historical session
 * extends the streak.
 */
function computeStreak(
  currentTrajectory: ScoreTrajectory,
  historyScores: number[],
): TrendData['streak'] {
  if (currentTrajectory === 'volatile') return null;

  let count = 1; // current session is part of the streak

  for (let i = 0; i < historyScores.length; i++) {
    const priors = historyScores.slice(i + 1, i + 1 + MIN_HISTORY_FOR_TRAJ);
    if (priors.length < MIN_HISTORY_FOR_TRAJ) break; // not enough history to compare

    const priorsAvg = mean(priors);
    const score = historyScores[i] as number;
    const direction: ScoreTrajectory =
      score > priorsAvg + SCORE_DELTA_THRESHOLD ? 'improving' :
      score < priorsAvg - SCORE_DELTA_THRESHOLD ? 'declining' :
      'stable';

    if (direction !== currentTrajectory) break;
    count++;
  }

  // A "streak" of just the current session isn't really a streak.
  if (count < 2) return null;
  return { count, direction: currentTrajectory };
}

function computeNewFileTypes(currentTypes: string[], history: HistoricalSession[]): string[] {
  const historical = new Set<string>();
  for (const h of history) {
    for (const t of h.fileTypesTouched) historical.add(t);
  }
  return currentTypes.filter((t) => !historical.has(t));
}
