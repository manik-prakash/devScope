import { TrendingUp, TrendingDown, RotateCcw, Zap, Bot } from 'lucide-react'
import type { Insight } from '@/lib/queries/me'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Zap,
  Bot,
} as const

// ─── Border / icon color per type ─────────────────────────────────────────────

const TYPE_STYLES: Record<Insight['type'], { border: string; icon: string }> = {
  positive: { border: 'var(--success)', icon: 'var(--success)' },
  neutral:  { border: 'var(--warning)', icon: 'var(--warning)' },
  negative: { border: 'var(--danger)',  icon: 'var(--danger)'  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightCard({ insight }: { insight: Insight }) {
  const Icon   = ICONS[insight.icon]
  const styles = TYPE_STYLES[insight.type]

  return (
    <div
      className="flex items-start gap-3 rounded border p-4"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        borderLeft:  `2px solid ${styles.border}`,
      }}
    >
      <Icon
        size={15}
        className="mt-0.5 shrink-0"
        style={{ color: styles.icon }}
      />
      <p className="text-sm leading-snug" style={{ color: 'var(--text-muted)' }}>
        {insight.text}
      </p>
    </div>
  )
}
