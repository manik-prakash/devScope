'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { average, initials, isWithinDays, formatRelativeTime, roleLabel } from '@/lib/utils'
import type { User, Session } from '@/lib/types'

// ─── Per-user computed stats ──────────────────────────────────────────────────

interface UserStats {
  projects:      string[]       // distinct project names from sessions
  lastActive:    string | null  // ISO date of most recent session
  monthSessions: number
  avgScore:      number | null
  isActive:      boolean        // has session in last 30 days
}

function computeUserStats(userId: string, sessions: Session[]): UserStats {
  const mine = sessions.filter((s) => s.userId === userId)

  const projects = [...new Set(mine.map((s) => s.project?.name).filter(Boolean) as string[])]

  const sorted     = [...mine].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const lastActive = sorted[0]?.createdAt ?? null

  const monthSessions = mine.filter((s) => isWithinDays(s.startedAt, 30)).length
  const scores        = mine.map((s) => s.score).filter((s): s is number => s !== null)
  const avgScore      = scores.length ? average(scores) : null
  const isActive      = monthSessions > 0

  return { projects, lastActive, monthSessions, avgScore, isActive }
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const elevated = role === 'MANAGER' || role === 'ADMIN'
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        background:  elevated ? 'rgba(37,99,235,0.1)'   : 'var(--surface-2)',
        color:       elevated ? '#93C5FD'                : 'var(--text-muted)',
        borderColor: elevated ? 'rgba(37,99,235,0.2)'   : 'var(--border)',
      }}
    >
      {roleLabel(role)}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={
        isActive
          ? {
              background:  'rgba(22,163,74,0.1)',
              color:       '#86EFAC',
              borderColor: 'rgba(22,163,74,0.2)',
            }
          : {
              background:  'var(--surface-2)',
              color:       'var(--text-faint)',
              borderColor: 'var(--border)',
            }
      }
    >
      {isActive ? 'Active' : 'Setup pending'}
    </span>
  )
}

// ─── Project pills ────────────────────────────────────────────────────────────

function ProjectPills({ projects }: { projects: string[] }) {
  const visible = projects.slice(0, 2)
  const extra   = projects.length - visible.length

  if (!projects.length) {
    return <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>—</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((p) => (
        <span
          key={p}
          className="rounded-full border px-2 py-0.5 text-xs"
          style={{
            background:  'var(--surface-2)',
            borderColor: 'var(--border)',
            color:       'var(--text-muted)',
          }}
        >
          {p}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
          +{extra} more
        </span>
      )}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface DeveloperTableProps {
  users:    User[]
  sessions: Session[]
  filter:   string          // search term applied to name + email
}

export function DeveloperTable({ users, sessions, filter }: DeveloperTableProps) {
  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [users, filter])

  const COL = 'px-4 py-3 text-sm'

  if (!filtered.length) {
    return (
      <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {filter ? `No developers match "${filter}"` : 'No developers found.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Developer', 'Projects', 'Role', 'Status', 'Last active', 'Sessions (30d)', 'Avg score'].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 pb-2 pt-0 text-left text-xs font-medium whitespace-nowrap"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => {
            const stats = computeUserStats(user.id, sessions)
            return (
              <tr
                key={user.id}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {/* Developer */}
                <td className={COL}>
                  <Link
                    href={`/dashboard/team/${user.id}`}
                    className="flex items-center gap-2.5 transition-colors duration-150"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                  >
                    {/* Avatar */}
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      {initials(user.name)}
                    </span>
                    <div>
                      <p className="font-medium" style={{ color: 'inherit' }}>{user.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{user.email}</p>
                    </div>
                  </Link>
                </td>

                {/* Projects */}
                <td className={COL}>
                  <ProjectPills projects={stats.projects} />
                </td>

                {/* Role */}
                <td className={COL}>
                  <RoleBadge role={user.role} />
                </td>

                {/* Status */}
                <td className={COL}>
                  <StatusBadge isActive={stats.isActive} />
                </td>

                {/* Last active */}
                <td className={COL} style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {stats.lastActive ? formatRelativeTime(stats.lastActive) : '—'}
                </td>

                {/* Sessions this month */}
                <td className={`${COL} font-mono`} style={{ color: 'var(--text-muted)' }}>
                  {stats.monthSessions}
                </td>

                {/* Avg score */}
                <td className={COL}>
                  <ScoreBadge score={stats.avgScore} size="sm" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
