'use client'

import { ArrowRight } from 'lucide-react'
import { ScoreBadge, AgentBadge } from '@/components/shared'
import { formatDuration, formatDateTime } from '@/lib/utils'
import type { Session } from '@/lib/types'

interface SessionCardProps {
  session:  Session
  onSelect: (id: string) => void
}

export function SessionCard({ session, onSelect }: SessionCardProps) {
  return (
    <div
      className="flex flex-col rounded border p-5 transition-colors duration-150 cursor-pointer"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onClick={() => onSelect(session.id)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Top row: timestamp + agent */}
      <div className="mb-4 flex items-center justify-between">
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--text-faint)' }}
        >
          {formatDateTime(session.startedAt)}
        </span>
        <AgentBadge agent={session.agent} />
      </div>

      {/* Middle: score + project */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {session.project?.name && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-xs"
              style={{
                background:  'var(--surface-2)',
                borderColor: 'var(--border)',
                color:       'var(--text-muted)',
              }}
            >
              {session.project.name}
            </span>
          )}
          <span
            className="text-xs capitalize"
            style={{
              color:
                session.evaluationStatus === 'SCORED'  ? 'var(--success)' :
                session.evaluationStatus === 'PENDING' ? 'var(--warning)' :
                session.evaluationStatus === 'FAILED'  ? 'var(--danger)'  :
                'var(--text-faint)',
            }}
          >
            {session.evaluationStatus.toLowerCase()}
          </span>
        </div>
        <ScoreBadge score={session.score} size="lg" />
      </div>

      {/* Bottom: duration + CTA */}
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatDuration(session.durationMs)}
        </span>
        <button
          className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
          onClick={(e) => { e.stopPropagation(); onSelect(session.id) }}
        >
          View details
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}
