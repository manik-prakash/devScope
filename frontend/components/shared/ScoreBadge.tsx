import { formatScore, scoreColors } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ScoreBadge({ score, size = 'md', className = '' }: ScoreBadgeProps) {
  const colors = scoreColors(score)
  const isNull = score === null || score === undefined

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono font-medium tabular-nums ${sizeClasses[size]} ${className}`}
      style={
        isNull
          ? {
              background: 'var(--surface-2)',
              color: 'var(--text-faint)',
              borderColor: 'var(--border)',
            }
          : {
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
            }
      }
    >
      {formatScore(score)}
    </span>
  )
}
