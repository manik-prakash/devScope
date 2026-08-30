'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PageHeader, StatCard, EmptyState, SessionDetailDrawer } from '@/components/shared'
import { RecentSessionsTable } from '@/components/manager/RecentSessionsTable'
import { SessionVolumeChart, DeveloperBarChart } from '@/components/charts'
import { useManagerSessions, AGGREGATE_LIMIT } from '@/lib/queries/sessions'
import { useManagerOrg } from '@/lib/queries/projects'
import { average, mode, isWithinDays, lastNDayLabels } from '@/lib/utils'
import type { Session } from '@/lib/types'

// ─── Data helpers ─────────────────────────────────────────────────────────────

function buildVolumeData(sessions: Session[]) {
  const labels = lastNDayLabels(30)
  const counts: Record<string, number> = {}
  for (const l of labels) counts[l] = 0

  for (const s of sessions) {
    const d    = new Date(s.startedAt)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (label in counts) counts[label]++
  }

  return labels.map((date) => ({ date, sessions: counts[date] }))
}

function buildDevBarData(sessions: Session[]) {
  const devMap: Record<string, { name: string; scores: number[] }> = {}

  for (const s of sessions) {
    const name = s.user?.name ?? 'Unknown'
    if (!devMap[name]) devMap[name] = { name, scores: [] }
    if (s.score !== null && s.score !== undefined) {
      devMap[name].scores.push(s.score)
    }
  }

  return Object.values(devMap)
    .filter((d) => d.scores.length > 0)
    .map((d) => ({ name: d.name, score: average(d.scores) }))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Fetch a larger slice for stat/chart computation, and the org record
  const { data: statsData, isLoading: statsLoading, isError: statsError } = useManagerSessions(1, AGGREGATE_LIMIT)
  const { data: tableData, isLoading: tableLoading, isError: tableError } = useManagerSessions(1, 10)
  const { data: org }                                 = useManagerOrg()

  const allSessions   = statsData?.sessions ?? []
  const tableSessions = tableData?.sessions ?? []

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const thisWeek  = allSessions.filter((s) => isWithinDays(s.startedAt, 7))
    const lastWeek  = allSessions.filter(
      (s) => !isWithinDays(s.startedAt, 7) && isWithinDays(s.startedAt, 14),
    )

    const scores       = allSessions.map((s) => s.score).filter((s): s is number => s !== null)
    const prevScores   = lastWeek.map((s) => s.score).filter((s): s is number => s !== null)
    const avgScore     = scores.length ? average(scores) : null
    const prevAvgScore = prevScores.length ? average(prevScores) : null

    const activeDev = new Set(allSessions.map((s) => s.userId)).size
    const topAgent  = mode(allSessions.map((s) => s.agent)) ?? '—'

    const sessionsDelta =
      lastWeek.length > 0
        ? ((thisWeek.length - lastWeek.length) / lastWeek.length) * 100
        : undefined

    const scoreDelta =
      avgScore !== null && prevAvgScore !== null && prevAvgScore > 0
        ? ((avgScore - prevAvgScore) / prevAvgScore) * 100
        : undefined

    return {
      sessionsThisWeek: thisWeek.length,
      sessionsDelta,
      avgScore,
      scoreDelta,
      activeDev,
      topAgent,
    }
  }, [allSessions])

  // ── Chart data ──────────────────────────────────────────────────────────────
  const volumeData = useMemo(() => buildVolumeData(allSessions), [allSessions])
  const devBarData = useMemo(() => buildDevBarData(allSessions), [allSessions])

  if (statsError && tableError) {
    return (
      <div className="space-y-8">
        <PageHeader title="Overview" subtitle={org ? org.name : undefined} />
        <EmptyState
          icon={AlertTriangle}
          heading="Couldn’t load the dashboard"
          subtext="Something went wrong reaching the server. Refresh to try again."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle={org ? org.name : undefined}
      />

      {statsError ? (
        <p className="-mt-4 text-xs" style={{ color: 'var(--warning)' }}>
          Couldn’t load session stats — the cards and charts below are hidden until you refresh.
        </p>
      ) : (
        allSessions.length >= AGGREGATE_LIMIT && (
          <p className="-mt-4 text-xs" style={{ color: 'var(--text-faint)' }}>
            Stats and charts are based on the {AGGREGATE_LIMIT.toLocaleString()} most recent sessions.
          </p>
        )
      )}

      {!statsError && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Sessions this week"
              value={stats.sessionsThisWeek}
              delta={stats.sessionsDelta}
              deltaLabel="vs last week"
              isLoading={statsLoading}
            />
            <StatCard
              label="Org avg score"
              value={stats.avgScore !== null ? Math.round(stats.avgScore) : '–'}
              delta={stats.scoreDelta}
              deltaLabel="vs last week"
              isLoading={statsLoading}
            />
            <StatCard
              label="Active developers"
              value={stats.activeDev}
              isLoading={statsLoading}
            />
            <StatCard
              label="Most used agent"
              value={stats.topAgent}
              mono={false}
              isLoading={statsLoading}
            />
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded border p-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="mb-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
                Session volume
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
                  last 30 days
                </span>
              </p>
              <SessionVolumeChart data={volumeData} height={200} isLoading={statsLoading} />
            </div>

            <div
              className="rounded border p-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="mb-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
                Avg score by developer
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
                  top 8
                </span>
              </p>
              <DeveloperBarChart data={devBarData} height={200} isLoading={statsLoading} />
            </div>
          </div>
        </>
      )}

      {/* ── Recent sessions table ── */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Recent sessions
          </p>
          <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
            {tableData?.pagination.total ?? 0} total
          </span>
        </div>

        <RecentSessionsTable
          sessions={tableSessions}
          isLoading={tableLoading}
          isError={tableError}
          onSelectSession={setSelectedSessionId}
        />
      </div>

      <SessionDetailDrawer
        sessionId={selectedSessionId}
        viewerRole="manager"
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  )
}
