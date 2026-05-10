import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  heading: string
  subtext?: string
  ctaLabel?: string
  ctaAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  heading,
  subtext,
  ctaLabel,
  ctaAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 text-center ${className}`}
    >
      <Icon
        size={40}
        strokeWidth={1.5}
        style={{ color: 'var(--text-faint)' }}
        className="mb-4"
      />

      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
        {heading}
      </p>

      {subtext && (
        <p className="mb-6 max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>
          {subtext}
        </p>
      )}

      {ctaLabel && ctaAction && (
        <button
          onClick={ctaAction}
          className="h-9 rounded px-4 text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)'
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
