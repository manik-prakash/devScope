'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreTrendPoint {
  date:  string
  score: number | null
}

interface Props {
  data:       ScoreTrendPoint[]
  height?:    number
  isLoading?: boolean
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const raw   = payload[0]?.value
  const score = typeof raw === 'number' ? raw : null

  return (
    <div
      className="rounded border px-3 py-2 text-sm shadow-lg"
      style={{
        background:  'var(--surface-2)',
        borderColor: 'var(--border)',
        color:       'var(--text)',
      }}
    >
      <p className="mb-1" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{label}</p>
      <p className="font-mono font-medium">
        {score !== null ? Math.round(score) : '–'}
        <span style={{ color: 'var(--text-faint)', fontFamily: 'inherit', fontWeight: 400 }}> / 100</span>
      </p>
    </div>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export function ScoreTrendChart({ data, height = 220, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div
        className="animate-pulse rounded"
        style={{ height, background: 'var(--surface-2)' }}
      />
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />

          <Tooltip
            content={CustomTooltip}
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          />

          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
