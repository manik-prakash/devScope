import Link from 'next/link'
import { ArrowRight, Users, Activity } from 'lucide-react'
import { ScoreBadge } from '@/components/shared'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project:      Project
  memberCount?: number
  weekSessions?: number
  avgScore?:    number | null
}

export function ProjectCard({
  project,
  memberCount  = 0,
  weekSessions = 0,
  avgScore     = null,
}: ProjectCardProps) {
  return (
    <div
      className="group flex flex-col rounded border p-6 transition-colors duration-150"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <h3 className="font-medium" style={{ color: 'var(--text)' }}>
          {project.name}
        </h3>
        <ScoreBadge score={avgScore} size="sm" />
      </div>

      {/* Stats */}
      <div className="mb-6 flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <Users size={13} style={{ color: 'var(--text-faint)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {memberCount}
            <span className="ml-1" style={{ color: 'var(--text-faint)' }}>
              {memberCount === 1 ? 'member' : 'members'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity size={13} style={{ color: 'var(--text-faint)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {weekSessions}
            <span className="ml-1" style={{ color: 'var(--text-faint)' }}>this week</span>
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/dashboard/projects/${project.slug}`}
        className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
        style={{ color: 'var(--text-faint)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
      >
        View project
        <ArrowRight size={12} />
      </Link>
    </div>
  )
}
