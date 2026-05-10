'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionVolumePoint {
  date:     string
  sessions: number
}

interface Props {
  data:       SessionVolumePoint[]
  height?:    number
  isLoading?: boolean
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value ?? 0

  return (
    <div
      className="rounded border px-3 py-2 text-sm shadow-lg"
      style={{
        background:  'var(--surface-2)',
        borderColor: 'var(--border)',
        color:       'var(--text)',
      }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{label}</p>
      <p className="mt-0.5 font-mono font-medium">
        {count}
        <span style={{ color: 'var(--text-faint)', fontFamily: 'inherit', fontWeight: 400 }}>
          {' '}session{count !== 1 ? 's' : ''}
        </span>
      </p>
    </div>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export function SessionVolumeChart({ data, height = 220, isLoading = false }: Props) {
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
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0}    />
            </linearGradient>
          </defs>

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
            allowDecimals={false}
            tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip content={CustomTooltip} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="sessions"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#sessionGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
