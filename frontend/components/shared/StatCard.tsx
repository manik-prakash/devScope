import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  delta?: number        // percentage, positive = up, negative = down
  deltaLabel?: string   // e.g. "vs last week"
  mono?: boolean        // use monospace font for value (default: true)
  isLoading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = 'vs last period',
  mono = true,
  isLoading = false,
  className = '',
}: StatCardProps) {
  if (isLoading) {
    return (
      <div
        className={`rounded border p-6 ${className}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="space-y-3">
          <div
            className="h-3 w-24 animate-pulse rounded"
            style={{ background: 'var(--surface-2)' }}
          />
          <div
            className="h-7 w-16 animate-pulse rounded"
            style={{ background: 'var(--surface-2)' }}
          />
          <div
            className="h-2.5 w-20 animate-pulse rounded"
            style={{ background: 'var(--surface-2)' }}
          />
        </div>
      </div>
    )
  }

  const hasDelta = delta !== undefined
  const isUp     = hasDelta && delta > 0
  const isDown   = hasDelta && delta < 0
  const isFlat   = hasDelta && delta === 0

  return (
    <div
      className={`rounded border p-6 ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p
        className="mb-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>

      <p
        className={`mb-3 text-2xl font-semibold leading-none ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--text)' }}
      >
        {value}
      </p>

      {hasDelta && (
        <div className="flex items-center gap-1.5">
          {isUp   && <TrendingUp  size={14} style={{ color: 'var(--success)' }} />}
          {isDown && <TrendingDown size={14} style={{ color: 'var(--danger)' }} />}
          {isFlat && <Minus        size={14} style={{ color: 'var(--text-faint)' }} />}

          <span
            className="text-xs tabular-nums"
            style={{
              color: isUp ? 'var(--success)' : isDown ? 'var(--danger)' : 'var(--text-faint)',
            }}
          >
            {isUp ? '+' : ''}{delta.toFixed(1)}%
          </span>

          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {deltaLabel}
          </span>
        </div>
      )}
    </div>
  )
}
