'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, Activity, AlertTriangle } from 'lucide-react'
import { PageHeader, StatCard, ScoreBadge, AgentBadge, EmptyState, SessionDetailDrawer, TruncationNotice } from '@/components/shared'
import { ScoreTrendChart } from '@/components/charts'
import { useManagerUsers } from '@/lib/queries/users'
import { useManagerSessions, AGGREGATE_LIMIT } from '@/lib/queries/sessions'
import {
  average,
  initials,
  isWithinDays,
  lastNDayLabels,
  formatDuration,
  formatRelativeTime,
  mode,
} from '@/lib/utils'
import { activeProjectId, ALL_PROJECTS_TAB } from '@/lib/queries/me'
import type { Session } from '@/lib/types'

// ─── Score trend (14 days) ────────────────────────────────────────────────────

function buildTrendData(sessions: Session[]) {
  const labels = lastNDayLabels(14)
  // For each day: pick the best score of sessions on that day
  const scoreByLabel: Record<string, number[]> = {}
  for (const l of labels) scoreByLabel[l] = []

  for (const s of sessions) {
    if (s.score === null || s.score === undefined) continue
    const label = new Date(s.startedAt).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
    })
    if (label in scoreByLabel) scoreByLabel[label].push(s.score)
  }

  return labels.map((date) => {
    const scores = scoreByLabel[date]
    return {
      date,
      score: scores.length ? average(scores) : null,
    }
  })
}

// ─── Session table for this developer ────────────────────────────────────────

interface SessionTableProps {
  sessions:        Session[]
  onSelectSession: (id: string) => void
}

function SessionTable({ sessions, onSelectSession }: SessionTableProps) {
  const COL = 'px-4 py-3 text-sm'

  if (!sessions.length) {
    return (
      <EmptyState
        icon={Activity}
        heading="No sessions yet"
        subtext="This developer hasn't submitted any sessions."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Project', 'Agent', 'Score', 'Duration', 'When'].map((h) => (
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
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <td className={COL} style={{ color: 'var(--text-muted)' }}>
                {s.project?.name ?? '—'}
              </td>
              <td className={COL}>
                <AgentBadge agent={s.agent} />
              </td>
              <td className={COL}>
                <ScoreBadge score={s.score} size="sm" />
              </td>
              <td className={`${COL} font-mono`} style={{ color: 'var(--text-muted)' }}>
                {formatDuration(s.durationMs)}
              </td>
              <td className={COL} style={{ color: 'var(--text-faint)' }}>
                {formatRelativeTime(s.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Developer detail (client component) ─────────────────────────────────────

export function DeveloperDetail({ userId }: { userId: string }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeProject, setActiveProject]         = useState<string | null>(null)

  const { data: users = [],  isLoading: usersLoading, isError: usersError }   = useManagerUsers()
  const { data: sessData,    isLoading: sessionsLoading, isError: sessError } = useManagerSessions(1, AGGREGATE_LIMIT)

  const user     = users.find((u) => u.id === userId)
  const sessions = sessData?.sessions ?? []

  // All sessions for this developer
  const userSessions = useMemo(
    () => sessions.filter((s) => s.userId === userId),
    [sessions, userId],
  )

  // Distinct projects this developer has sessions in
  const projects = useMemo(() => {
    const seen = new Map<string, string>()       // id → name
    for (const s of userSessions) {
      if (s.projectId && s.project?.name) seen.set(s.projectId, s.project.name)
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [userSessions])

  // Set default active project once projects are loaded
  const currentProjectId = activeProjectId(activeProject, projects[0]?.id)

  // Sessions filtered to current project tab
  const tabSessions = useMemo(
    () =>
      currentProjectId
        ? userSessions.filter((s) => s.projectId === currentProjectId)
        : userSessions,
    [userSessions, currentProjectId],
  )

  // Stats for current tab
  const stats = useMemo(() => {
    const thisWeek = tabSessions.filter((s) => isWithinDays(s.startedAt, 7))
    const scores   = tabSessions.map((s) => s.score).filter((s): s is number => s !== null)
    const topAgent = mode(tabSessions.map((s) => s.agent)) ?? '—'
    return {
      sessionsThisWeek: thisWeek.length,
      avgScore:         scores.length ? average(scores) : null,
      totalSessions:    tabSessions.length,
      topAgent,
    }
  }, [tabSessions])

  // Score trend data for current tab
  const trendData = useMemo(() => buildTrendData(tabSessions), [tabSessions])

  const isLoading = usersLoading || sessionsLoading

  if (usersError) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/team" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={13} /> Back to team
        </Link>
        <EmptyState
          icon={AlertTriangle}
          heading="Couldn’t load this developer"
          subtext="Something went wrong reaching the server. Refresh to try again."
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/team"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={13} /> Back to team
        </Link>
        <p style={{ color: 'var(--text-muted)' }}>Developer not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard/team"
        className="flex items-center gap-1.5 text-xs transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <ChevronLeft size={13} /> Team
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          {initials(user.name)}
        </div>
        <div>
          <h1 className="text-h1 font-semibold" style={{ color: 'var(--text)' }}>
            {user.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Project tabs */}
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {/* "All" tab */}
          <button
            onClick={() => setActiveProject(ALL_PROJECTS_TAB)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150"
            style={
              activeProject === ALL_PROJECTS_TAB
                ? { background: 'var(--accent-dim)', borderColor: 'rgba(37,99,235,0.25)', color: 'var(--accent)' }
                : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
            }
          >
            All projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.id)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150"
              style={
                currentProjectId === p.id
                  ? { background: 'var(--accent-dim)', borderColor: 'rgba(37,99,235,0.25)', color: 'var(--accent)' }
                  : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {sessError ? (
        <p className="text-xs" style={{ color: 'var(--warning)' }}>
          Couldn’t load session data — the stats and trend below may be incomplete.
        </p>
      ) : (
        <TruncationNotice shown={sessions.length} limit={AGGREGATE_LIMIT} />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sessions this week" value={stats.sessionsThisWeek} />
        <StatCard
          label="Avg score"
          value={stats.avgScore !== null ? Math.round(stats.avgScore) : '–'}
        />
        <StatCard label="Total sessions" value={stats.totalSessions} />
        <StatCard label="Top agent"      value={stats.topAgent} mono={false} />
      </div>

      {/* Score trend chart */}
      <div
        className="rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--text)' }}>
          Score trend
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
            last 14 days
          </span>
        </p>
        <ScoreTrendChart data={trendData} height={200} />
      </div>

      {/* Session history */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Session history
            <span className="ml-2 font-mono text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
              {tabSessions.length} total
            </span>
          </p>
        </div>
        <SessionTable
          sessions={tabSessions}
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
