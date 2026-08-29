import { describe, it, expect } from 'vitest'
import { buildTrendData, subScores, activeProjectId, ALL_PROJECTS_TAB } from '@/lib/queries/me'
import type { Session, SessionStats } from '@/lib/types'

describe('activeProjectId', () => {
  it('returns null (show all) when the All tab is selected', () => {
    expect(activeProjectId(ALL_PROJECTS_TAB, 'p1')).toBeNull()
  })

  it('returns the selected project id', () => {
    expect(activeProjectId('p2', 'p1')).toBe('p2')
  })

  it('defaults to the first project before any tab is chosen', () => {
    expect(activeProjectId(null, 'p1')).toBe('p1')
    expect(activeProjectId(null, undefined)).toBeNull()
  })
})

describe('buildTrendData', () => {
  it('does not fold a session from a year ago into a recent day', () => {
    const now = new Date()
    const yearAgo = new Date(now)
    yearAgo.setFullYear(now.getFullYear() - 1)

    const sessions = [
      { startedAt: now.toISOString(), score: 80 },
      { startedAt: yearAgo.toISOString(), score: 20 },
    ] as unknown as Session[]

    const trend = buildTrendData(sessions)

    // Today's bucket is the last point; it must reflect only the recent session.
    expect(trend[trend.length - 1]?.score).toBe(80)
  })

  it('returns 14 points', () => {
    expect(buildTrendData([])).toHaveLength(14)
  })
})

describe('subScores', () => {
  it('uses the real evaluator dimensions when scoreDetail is present', () => {
    const s = subScores({
      scoreDetail: { promptQuality: 73, iterationEfficiency: 61, toolUtilization: 44 },
      // deliberately-degenerate stats that the heuristic would score very differently
      stats: { avgPromptLength: 99999, totalIterations: 0, totalPrompts: 1, totalToolCalls: 99 },
    } as unknown as Session)

    expect(s).toEqual({ promptQuality: 73, iterationEfficiency: 61, toolUtilization: 44 })
  })

  it('falls back to the stats heuristic when scoreDetail is absent (legacy / unsigned sessions)', () => {
    const s = subScores({
      stats: {
        avgPromptLength: 500,
        totalIterations: 2,
        totalPrompts: 2,
        totalToolCalls: 6,
      } as unknown as SessionStats,
    } as unknown as Session)

    expect(s.promptQuality).toBeGreaterThan(0)
    expect(s.toolUtilization).toBeGreaterThan(0)
    expect(s.iterationEfficiency).toBeGreaterThan(0)
    expect(s.iterationEfficiency).toBeLessThanOrEqual(100)
  })

  it('returns zeros when neither is present', () => {
    expect(subScores(undefined)).toEqual({ promptQuality: 0, iterationEfficiency: 0, toolUtilization: 0 })
  })
})
