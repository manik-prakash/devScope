import { useMemo } from 'react'
import { useDeveloperSessions } from './sessions'
import {
  average,
  mode,
  isWithinDays,
  clamp,
  formatDurationLong,
} from '@/lib/utils'
import type { Session, SessionStats } from '@/lib/types'
import type { RadarDataPoint, ScoreTrendPoint } from '@/components/charts'

// ─── Sub-score computation (mirrors the drawer logic) ─────────────────────────

// Local calendar day as YYYY-MM-DD — used to bucket sessions by day without the
// month/day-only label colliding across years.
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface SubScores {
  promptQuality:       number
  iterationEfficiency: number
  toolUtilization:     number
}

// Per-dimension scores for a session. Prefers the real evaluator output
// (`scoreDetail`, from the multi-stage pipeline); falls back to a rough
// stats-derived heuristic only for legacy / unsigned / unscored sessions that
// have no `scoreDetail`.
export function subScores(session: Pick<Session, 'scoreDetail' | 'stats'> | undefined): SubScores {
  const detail = session?.scoreDetail
  if (detail) {
    return {
      promptQuality:       detail.promptQuality,
      iterationEfficiency: detail.iterationEfficiency,
      toolUtilization:     detail.toolUtilization,
    }
  }

  const stats = session?.stats
  if (!stats) return { promptQuality: 0, iterationEfficiency: 0, toolUtilization: 0 }
  const avg   = stats.avgPromptLength ?? 0
  const iters = stats.totalIterations ?? 0
  const tools = stats.totalToolCalls  ?? 0
  const proms = Math.max(1, stats.totalPrompts ?? 1)
  return {
    promptQuality:       clamp(avg / 5, 0, 100),
    iterationEfficiency: clamp(100 - (iters / proms) * 15, 0, 100),
    toolUtilization:     clamp((tools / proms) * 20, 0, 100),
  }
}

// ─── Insight types ────────────────────────────────────────────────────────────

export type InsightType = 'positive' | 'neutral' | 'negative'

export interface Insight {
  type:  InsightType
  icon:  'TrendingUp' | 'TrendingDown' | 'RotateCcw' | 'Zap' | 'Bot'
  text:  string
}

// ─── Insight generation ───────────────────────────────────────────────────────

function buildInsights(thisWeek: Session[], lastWeek: Session[]): Insight[] {
  const insights: Insight[] = []

  // 1. Score trend
  const thisScores = thisWeek.map((s) => s.score).filter((s): s is number => s !== null)
  const prevScores = lastWeek.map((s) => s.score).filter((s): s is number => s !== null)
  if (thisScores.length && prevScores.length) {
    const diff = average(thisScores) - average(prevScores)
    if (Math.abs(diff) >= 3) {
      insights.push({
        type: diff > 0 ? 'positive' : 'negative',
        icon: diff > 0 ? 'TrendingUp' : 'TrendingDown',
        text: `Overall score ${diff > 0 ? '↑' : '↓'}${Math.abs(Math.round(diff))} pts vs last week`,
      })
    }
  }

  // 2. Iteration efficiency
  if (thisWeek.length) {
    const iterRatios = thisWeek.map((s) => {
      const stats = s.stats as SessionStats | undefined
      if (!stats) return null
      const proms = Math.max(1, stats.totalPrompts ?? 1)
      return (stats.totalIterations ?? 0) / proms
    }).filter((r): r is number => r !== null)

    if (iterRatios.length) {
      const avgIter = average(iterRatios)
      const rounded = Math.round(avgIter * 10) / 10
      insights.push({
        type: avgIter < 2 ? 'positive' : avgIter < 5 ? 'neutral' : 'negative',
        icon: 'RotateCcw',
        text:
          avgIter < 2
            ? `Avg ${rounded} iterations/session — very efficient`
            : avgIter >= 5
            ? `Avg ${rounded} iterations/session — try clearer prompts`
            : `Avg ${rounded} iterations/session`,
      })
    }
  }

  // 3. Most active agent
  const allSessions = [...thisWeek, ...lastWeek]
  const topAgent    = mode(allSessions.map((s) => s.agent))
  if (topAgent) {
    insights.push({
      type: 'neutral',
      icon: 'Bot',
      text: `Most active with ${topAgent} this period`,
    })
  }

  // Always return at least one card
  if (!insights.length) {
    insights.push({
      type: 'neutral',
      icon: 'Zap',
      text: 'Run devscope to start capturing sessions',
    })
  }

  return insights.slice(0, 3)
}

// ─── Score trend data (14 days) ───────────────────────────────────────────────

export function buildTrendData(sessions: Session[]): ScoreTrendPoint[] {
  // Bucket by ISO day (year-aware) but keep a short display label for the axis.
  const days: { iso: string; label: string }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      iso:   isoDay(d),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
  }

  const byIso: Record<string, number[]> = {}
  for (const { iso } of days) byIso[iso] = []

  for (const s of sessions) {
    if (s.score === null || s.score === undefined) continue
    const iso = isoDay(new Date(s.startedAt))
    if (iso in byIso) byIso[iso].push(s.score)
  }

  return days.map(({ iso, label }) => {
    const scores = byIso[iso]
    return { date: label, score: scores.length ? average(scores) : null }
  })
}

// ─── Radar data ───────────────────────────────────────────────────────────────

export function buildRadarData(thisWeek: Session[], lastWeek: Session[]): RadarDataPoint[] {
  function avgSubScores(sessions: Session[]) {
    if (!sessions.length) return { promptQuality: 0, iterationEfficiency: 0, toolUtilization: 0 }
    const pq:  number[] = []
    const ie:  number[] = []
    const tu:  number[] = []
    for (const s of sessions) {
      const sc = subScores(s)
      pq.push(sc.promptQuality)
      ie.push(sc.iterationEfficiency)
      tu.push(sc.toolUtilization)
    }
    return {
      promptQuality:       average(pq),
      iterationEfficiency: average(ie),
      toolUtilization:     average(tu),
    }
  }

  const curr = avgSubScores(thisWeek)
  const prev = avgSubScores(lastWeek)

  return [
    { metric: 'Prompt Quality',       current: curr.promptQuality,       previous: prev.promptQuality       },
    { metric: 'Iteration Efficiency', current: curr.iterationEfficiency,  previous: prev.iterationEfficiency  },
    { metric: 'Tool Utilization',     current: curr.toolUtilization,      previous: prev.toolUtilization      },
  ]
}

// ─── Per-project breakdown ────────────────────────────────────────────────────

export interface ProjectTab {
  id:   string
  name: string
}

// Sentinel for the "All projects" tab. A plain `null` selection can't be told
// apart from "no tab chosen yet", which is why the All button used to fall
// straight back to the first project.
export const ALL_PROJECTS_TAB = '__all__'

// Resolve the active project-tab selection to a concrete project id (or null =
// show every project).
export function activeProjectId(tab: string | null, firstId: string | undefined): string | null {
  if (tab === ALL_PROJECTS_TAB) return null
  return tab ?? firstId ?? null
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useDevDashboard(projectId: string | null) {
  const { data: sessData, isLoading, isError } = useDeveloperSessions(1, 100)
  const allSessions                   = sessData?.sessions ?? []

  // Distinct projects
  const projects = useMemo((): ProjectTab[] => {
    const seen = new Map<string, string>()
    for (const s of allSessions) {
      if (s.projectId && s.project?.name) seen.set(s.projectId, s.project.name)
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [allSessions])

  // Filter to selected project
  const filtered = useMemo(
    () => (projectId ? allSessions.filter((s) => s.projectId === projectId) : allSessions),
    [allSessions, projectId],
  )

  const thisWeek = useMemo(() => filtered.filter((s) => isWithinDays(s.startedAt, 7)),  [filtered])
  const lastWeek = useMemo(
    () => filtered.filter((s) => !isWithinDays(s.startedAt, 7) && isWithinDays(s.startedAt, 14)),
    [filtered],
  )

  // Stat cards
  const stats = useMemo(() => {
    const thisWeekScores  = thisWeek.map((s) => s.score).filter((s): s is number => s !== null)
    const monthSessions   = filtered.filter((s) => isWithinDays(s.startedAt, 30))
    const bestThisMonth   = monthSessions.reduce<number | null>(
      (best, s) => (s.score !== null && (best === null || s.score > best) ? s.score : best),
      null,
    )
    const totalMs = filtered.reduce((sum, s) => sum + parseInt(String(s.durationMs), 10), 0)

    return {
      sessionsThisWeek: thisWeek.length,
      avgScoreThisWeek: thisWeekScores.length ? average(thisWeekScores) : null,
      bestThisMonth,
      totalTime:        isNaN(totalMs) ? '—' : formatDurationLong(totalMs),
    }
  }, [thisWeek, lastWeek, filtered])

  // Charts
  const trendData = useMemo(() => buildTrendData(filtered), [filtered])
  const radarData = useMemo(() => buildRadarData(thisWeek, lastWeek), [thisWeek, lastWeek])

  // Insights
  const insights  = useMemo(() => buildInsights(thisWeek, lastWeek), [thisWeek, lastWeek])

  return { isLoading, isError, projects, filtered, thisWeek, stats, trendData, radarData, insights }
}
