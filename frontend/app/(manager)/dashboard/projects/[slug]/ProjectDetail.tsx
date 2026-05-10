'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { PageHeader, StatCard, ScoreBadge, AgentBadge, EmptyState, SessionDetailDrawer } from '@/components/shared'
import { SessionVolumeChart } from '@/components/charts'
import { useManagerProject } from '@/lib/queries/projects'
import { useManagerSessions } from '@/lib/queries/sessions'
import {
  average,
  mode,
  isWithinDays,
  lastNDayLabels,
  formatDuration,
  formatRelativeTime,
} from '@/lib/utils'
import type { Session } from '@/lib/types'

// ─── Data helpers ─────────────────────────────────────────────────────────────

function buildVolumeData(sessions: Session[]) {
  const labels = lastNDayLabels(30)
  const counts: Record<string, number> = {}
  for (const l of labels) counts[l] = 0
  for (const s of sessions) {
    const label = new Date(s.startedAt).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
    })
    if (label in counts) counts[label]++
  }
  return labels.map((date) => ({ date, sessions: counts[date] }))
}

interface DevStats {
  userId:       string
  name:         string
  weekSessions: number
  avgScore:     number | null
  prevAvgScore: number | null
  topAgent:     string
}

function buildLeaderboard(sessions: Session[]): DevStats[] {
  const map: Record<string, { name: string; thisWeek: number[]; lastWeek: number[]; agents: string[] }> = {}

  for (const s of sessions) {
    const id   = s.userId
    const name = s.user?.name ?? 'Unknown'
    if (!map[id]) map[id] = { name, thisWeek: [], lastWeek: [], agents: [] }

    map[id].agents.push(s.agent)

    if (s.score === null || s.score === undefined) continue

    if (isWithinDays(s.startedAt, 7)) {
      map[id].thisWeek.push(s.score)
    } else if (isWithinDays(s.startedAt, 14)) {
      map[id].lastWeek.push(s.score)
    }
  }

  return Object.entries(map)
    .map(([userId, d]) => ({
      userId,
      name:         d.name,
      weekSessions: d.thisWeek.length,
      avgScore:     d.thisWeek.length ? average(d.thisWeek) : null,
      prevAvgScore: d.lastWeek.length ? average(d.lastWeek) : null,
      topAgent:     mode(d.agents) ?? '—',
    }))
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
}

// ─── Leaderboard table ────────────────────────────────────────────────────────

function Leaderboard({ entries }: { entries: DevStats[] }) {
  const COL = 'px-4 py-3 text-sm'

  if (!entries.length) {
    return (
      <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No session data yet for this project.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'Developer', 'Sessions (wk)', 'Avg score', 'Top agent', 'Trend'].map((h) => (
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
          {entries.map((dev, i) => {
            const delta =
              dev.avgScore !== null && dev.prevAvgScore !== null
                ? dev.avgScore - dev.prevAvgScore
                : null

            const TrendIcon =
              delta === null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
            const trendColor =
              delta === null
                ? 'var(--text-faint)'
                : delta > 0
                ? 'var(--success)'
                : delta < 0
                ? 'var(--danger)'
                : 'var(--text-faint)'

            return (
              <tr
                key={dev.userId}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <td className={`${COL} font-mono`} style={{ color: 'var(--text-faint)' }}>
                  {i + 1}
                </td>
                <td className={COL} style={{ color: 'var(--text)' }}>
                  {dev.name}
                </td>
                <td className={`${COL} font-mono`} style={{ color: 'var(--text-muted)' }}>
                  {dev.weekSessions}
                </td>
                <td className={COL}>
                  <ScoreBadge score={dev.avgScore} size="sm" />
                </td>
                <td className={COL}>
                  <AgentBadge agent={dev.topAgent} />
                </td>
                <td className={COL}>
                  {TrendIcon ? (
                    <TrendIcon size={14} style={{ color: trendColor }} />
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Session feed ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

interface SessionFeedProps {
  sessions:        Session[]
  onSelectSession: (id: string) => void
}

function SessionFeed({ sessions, onSelectSession }: SessionFeedProps) {
  const [page, setPage] = useState(1)
  const total      = sessions.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const visible    = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const COL        = 'px-4 py-3 text-sm'

  if (!sessions.length) {
    return (
      <EmptyState
        icon={Activity}
        heading="No sessions for this project"
        subtext="Sessions submitted with this project slug will appear here."
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Developer', 'Agent', 'Score', 'Duration', 'Date'].map((h) => (
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
            {visible.map((s) => (
              <tr
                key={s.id}
                className="cursor-pointer transition-colors duration-150"
                style={{ borderBottom: '1px solid var(--border)' }}
                onClick={() => onSelectSession(s.id)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <td className={COL} style={{ color: 'var(--text)' }}>
                  {s.user?.name ?? '—'}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Project detail (client component) ───────────────────────────────────────

export function ProjectDetail({ slug }: { slug: string }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const { data: project, isLoading: projLoading } = useManagerProject(slug)
  const { data: sessData, isLoading: sessLoading } = useManagerSessions(1, 200)

  const allSessions = sessData?.sessions ?? []

  // Filter sessions to this project client-side (API doesn't support projectId filter yet)
  const projectSessions = useMemo(
    () => (project ? allSessions.filter((s) => s.projectId === project.id) : []),
    [allSessions, project],
  )

  const stats = useMemo(() => {
    const scores    = projectSessions.map((s) => s.score).filter((s): s is number => s !== null)
    const thisWeek  = projectSessions.filter((s) => isWithinDays(s.startedAt, 7))
    const avgScore  = scores.length ? average(scores) : null
    const activeDev = new Set(projectSessions.map((s) => s.userId)).size
    const topAgent  = mode(projectSessions.map((s) => s.agent)) ?? '—'
    return { sessionsThisWeek: thisWeek.length, avgScore, activeDev, topAgent }
  }, [projectSessions])

  const volumeData  = useMemo(() => buildVolumeData(projectSessions), [projectSessions])
  const leaderboard = useMemo(() => buildLeaderboard(projectSessions), [projectSessions])

  if (projLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/projects"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={13} /> Back to projects
        </Link>
        <p style={{ color: 'var(--text-muted)' }}>Project &ldquo;{slug}&rdquo; not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard/projects"
        className="flex items-center gap-1.5 text-xs transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <ChevronLeft size={13} /> Projects
      </Link>

      <PageHeader
        title={project.name}
        subtitle={`/${project.slug}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sessions this week" value={stats.sessionsThisWeek} isLoading={sessLoading} />
        <StatCard
          label="Avg score"
          value={stats.avgScore !== null ? Math.round(stats.avgScore) : '–'}
          isLoading={sessLoading}
        />
        <StatCard label="Active developers"  value={stats.activeDev}  isLoading={sessLoading} />
        <StatCard label="Most used agent"    value={stats.topAgent}   mono={false} isLoading={sessLoading} />
      </div>

      {/* Volume chart */}
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
        <SessionVolumeChart data={volumeData} height={200} isLoading={sessLoading} />
      </div>

      {/* Developer leaderboard */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Developer leaderboard
          </p>
        </div>
        <Leaderboard entries={leaderboard} />
      </div>

      {/* Session feed */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Sessions
            <span className="ml-2 font-mono text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
              {projectSessions.length} total
            </span>
          </p>
        </div>
        <SessionFeed
          sessions={projectSessions}
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
