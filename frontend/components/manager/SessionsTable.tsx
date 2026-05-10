'use client'

import { ScoreBadge, AgentBadge } from '@/components/shared'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/lib/types'

interface SessionsTableProps {
  sessions:        Session[]
  onSelectSession: (id: string) => void
}

export function SessionsTable({ sessions, onSelectSession }: SessionsTableProps) {
  const COL = 'px-4 py-3 text-sm'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Developer', 'Project', 'Agent', 'Score', 'Duration', 'Date'].map((h) => (
              <th
                key={h}
                className="px-4 pb-2 pt-0 text-left text-xs font-medium whitespace-nowrap"
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
              <td className={COL} style={{ color: 'var(--text)' }}>
                {s.user?.name ?? '—'}
              </td>
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
              <td className={COL} style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                {formatRelativeTime(s.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
