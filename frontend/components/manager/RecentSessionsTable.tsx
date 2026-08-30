import { Activity, AlertTriangle } from 'lucide-react'
import { ScoreBadge, AgentBadge, EmptyState } from '@/components/shared'
import { formatDuration, formatRelativeTime } from '@/lib/utils'
import type { Session } from '@/lib/types'

interface RecentSessionsTableProps {
  sessions:        Session[]
  isLoading:       boolean
  isError?:        boolean
  onSelectSession: (id: string) => void
}

export function RecentSessionsTable({
  sessions,
  isLoading,
  isError = false,
  onSelectSession,
}: RecentSessionsTableProps) {
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

  if (isError) {
    return (
      <EmptyState
        icon={AlertTriangle}
        heading="Couldn’t load recent sessions"
        subtext="Something went wrong reaching the server. Refresh to try again."
      />
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
