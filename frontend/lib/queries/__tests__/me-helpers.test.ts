import { describe, it, expect } from 'vitest'
import { buildTrendData, subScores } from '@/lib/queries/me'
import type { Session, SessionStats } from '@/lib/types'

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
  it('produces non-degenerate values from camelCase stats', () => {
    const s = subScores({
      avgPromptLength: 500,
      totalIterations: 2,
      totalPrompts: 2,
      totalToolCalls: 6,
    } as unknown as SessionStats)

    expect(s.promptQuality).toBeGreaterThan(0)
    expect(s.toolUtilization).toBeGreaterThan(0)
    expect(s.iterationEfficiency).toBeGreaterThan(0)
    expect(s.iterationEfficiency).toBeLessThanOrEqual(100)
  })
})
