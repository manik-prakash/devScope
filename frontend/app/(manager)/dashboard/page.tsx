'use client'

import { useState, useMemo } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { PageHeader, StatCard, ScoreBadge, AgentBadge, EmptyState, SessionDetailDrawer } from '@/components/shared'
import { SessionVolumeChart, DeveloperBarChart } from '@/components/charts'
import { useManagerSessions } from '@/lib/queries/sessions'
import { useManagerOrg } from '@/lib/queries/projects'
import {
  formatDuration,
  formatRelativeTime,
  average,
  mode,
  isWithinDays,
  lastNDayLabels,
} from '@/lib/utils'
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

// ─── Recent sessions table ────────────────────────────────────────────────────

interface RecentSessionsTableProps {
  sessions:            Session[]
  isLoading:           boolean
  onSelectSession:     (id: string) => void
}

function RecentSessionsTable({ sessions, isLoading, onSelectSession }: RecentSessionsTableProps) {
  const COL_CLASS = 'px-4 py-3 text-sm'

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded"
            style={{ background: 'var(--surface-2)' }}
          />
        ))}
      </div>
    )
  }

  if (!sessions.length) {
    return (
      <EmptyState
        icon={Activity}
        heading="No sessions yet"
        subtext="Sessions will appear here once developers run the CLI."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Developer', 'Project', 'Agent', 'Score', 'Duration', 'When'].map((h) => (
              <th
                key={h}
                className="px-4 pb-2 pt-0 text-left text-xs font-medium"
                style={{ color: 'var(--text-faint)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="cursor-pointer transition-colors duration-150"
              style={{ borderBottom: '1px solid var(--border)' }}
              onClick={() => onSelectSession(s.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <td className={COL_CLASS} style={{ color: 'var(--text)' }}>
                {s.user?.name ?? '—'}
              </td>
              <td className={COL_CLASS} style={{ color: 'var(--text-muted)' }}>
                {s.project?.name ?? '—'}
              </td>
              <td className={COL_CLASS}>
                <AgentBadge agent={s.agent} />
              </td>
              <td className={COL_CLASS}>
                <ScoreBadge score={s.score} />
              </td>
              <td
                className={`${COL_CLASS} font-mono`}
                style={{ color: 'var(--text-muted)' }}
              >
                {formatDuration(s.durationMs)}
              </td>
              <td className={COL_CLASS} style={{ color: 'var(--text-faint)' }}>
                {formatRelativeTime(s.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Fetch a larger slice for stat/chart computation, and the org record
  const { data: statsData, isLoading: statsLoading, isError: statsError } = useManagerSessions(1, 100)
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
