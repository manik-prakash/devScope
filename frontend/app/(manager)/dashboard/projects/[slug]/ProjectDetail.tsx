'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Activity, UserPlus, Check } from 'lucide-react'
import { PageHeader, StatCard, ScoreBadge, AgentBadge, EmptyState, SessionDetailDrawer, Pagination } from '@/components/shared'
import { SessionVolumeChart } from '@/components/charts'
import { InviteUserModal } from '@/components/manager/InviteUserModal'
import { TempPasswordModal } from '@/components/manager/TempPasswordModal'
import { useManagerProject, managerProjectQueryKey } from '@/lib/queries/projects'
import { useManagerSessions, AGGREGATE_LIMIT } from '@/lib/queries/sessions'
import { MANAGER_USERS_QUERY_KEY, ADMIN_USERS_QUERY_KEY } from '@/lib/queries/users'
import {
  average,
  mode,
  isWithinDays,
  lastNDayLabels,
  formatDuration,
  formatRelativeTime,
  initials,
  paginate,
} from '@/lib/utils'
import type { Session, InvitedUserResult, ProjectMember } from '@/lib/types'

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

interface SessionFeedProps {
  sessions:        Session[]
  onSelectSession: (id: string) => void
}

function SessionFeed({ sessions, onSelectSession }: SessionFeedProps) {
  const [page, setPage] = useState(1)
  const { totalPages, safePage, visible } = paginate(sessions, page)
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

      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        className="flex items-center justify-between border-t px-4 py-3"
      />
    </div>
  )
}

// ─── Project detail (client component) ───────────────────────────────────────

export function ProjectDetail({ slug }: { slug: string }) {
  const queryClient = useQueryClient()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [showInvite, setShowInvite]               = useState(false)
  const [tempResult, setTempResult]               = useState<InvitedUserResult | null>(null)
  const [inlineSuccess, setInlineSuccess]         = useState<string | null>(null)

  const { data: project, isLoading: projLoading } = useManagerProject(slug)
  const { data: sessData, isLoading: sessLoading } = useManagerSessions(1, AGGREGATE_LIMIT)

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
        action={
          <button
            onClick={() => setShowInvite(true)}
            className="flex h-9 items-center gap-2 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            <UserPlus size={14} />
            Add engineer
          </button>
        }
      />

      {inlineSuccess && (
        <div
          className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
          style={{
            background:  'rgba(22,163,74,0.08)',
            borderColor: 'rgba(22,163,74,0.2)',
            color:       'var(--success)',
          }}
        >
          <Check size={14} />
          {inlineSuccess}
        </div>
      )}

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

      {/* Members */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Members
            <span className="ml-2 font-mono text-xs font-normal" style={{ color: 'var(--text-faint)' }}>
              {project.members.length}
            </span>
          </p>
        </div>
        <MembersList members={project.members} />
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

      {showInvite && (
        <InviteUserModal
          title="Add engineer"
          submitLabel="Send invite"
          endpoint={`/manager/projects/${project.id}/members`}
          onClose={() => setShowInvite(false)}
          onSuccess={async (result) => {
            setShowInvite(false)
            // Existing user added to this project → no temp password, inline success
            if (result.isExisting) {
              setInlineSuccess(`${result.name} added to ${project.name}`)
              setTimeout(() => setInlineSuccess(null), 3500)
            } else if (result.tempPassword) {
              setTempResult(result)
            }
            await queryClient.invalidateQueries({ queryKey: managerProjectQueryKey(slug) })
            await queryClient.invalidateQueries({ queryKey: MANAGER_USERS_QUERY_KEY })
            await queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
          }}
        />
      )}

      {tempResult && tempResult.tempPassword && (
        <TempPasswordModal
          result={{ ...tempResult, tempPassword: tempResult.tempPassword }}
          onClose={() => setTempResult(null)}
        />
      )}
    </div>
  )
}

// ─── Members list ─────────────────────────────────────────────────────────────

function MembersList({ members }: { members: ProjectMember[] }) {
  if (members.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No members yet. Add engineers to start tracking sessions.
      </p>
    )
  }

  const COL = 'px-4 py-3 text-sm'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Member', 'Role', 'Status', 'Added'].map((h) => (
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
          {members.map((m) => (
            <tr key={m.userId} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className={COL}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  >
                    {initials(m.user.name)}
                  </span>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{m.user.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{m.user.email}</p>
                  </div>
                </div>
              </td>
              <td className={COL}>
                <span
                  className="rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{
                    background:  m.user.role === 'MANAGER' ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
                    color:       m.user.role === 'MANAGER' ? '#93C5FD'              : 'var(--text-muted)',
                    borderColor: m.user.role === 'MANAGER' ? 'rgba(37,99,235,0.2)'  : 'var(--border)',
                  }}
                >
                  {m.user.role === 'MANAGER' ? 'Manager' : m.user.role === 'ADMIN' ? 'Admin' : 'Engineer'}
                </span>
              </td>
              <td className={COL}>
                {m.user.mustChangePass ? (
                  <span
                    className="rounded-full border px-2 py-0.5 text-xs"
                    style={{
                      background:  'rgba(217,119,6,0.08)',
                      color:       '#FCD34D',
                      borderColor: 'rgba(217,119,6,0.2)',
                    }}
                  >
                    Pending first login
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Active</span>
                )}
              </td>
              <td className={COL} style={{ color: 'var(--text-faint)' }}>
                {formatRelativeTime(m.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
