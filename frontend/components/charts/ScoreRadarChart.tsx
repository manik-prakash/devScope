'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarDataPoint {
  metric:   string   // axis label
  current:  number   // 0-100, this week
  previous: number   // 0-100, last week
}

interface Props {
  data:       RadarDataPoint[]
  height?:    number
  isLoading?: boolean
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded border px-3 py-2 text-sm shadow-lg"
      style={{
        background:  'var(--surface-2)',
        borderColor: 'var(--border)',
        color:       'var(--text)',
        minWidth:    '140px',
      }}
    >
      <p className="mb-1.5 font-medium" style={{ fontSize: '11px' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{String(entry.name ?? '')}</span>
          <span className="font-mono text-xs font-medium" style={{ color: entry.color }}>
            {typeof entry.value === 'number' ? Math.round(entry.value) : '–'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom legend ────────────────────────────────────────────────────────────

function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-5 pt-2">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ background: '#2563EB' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>This week</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Last week</span>
      </div>
    </div>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export function ScoreRadarChart({ data, height = 260, isLoading = false }: Props) {
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
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
          <PolarGrid
            stroke="var(--border)"
            gridType="polygon"
          />

          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
          />

          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--text-faint)', fontSize: 9 }}
            tickCount={4}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={CustomTooltip} />

          {/* Last week — gray outline, no fill */}
          <Radar
            name="Last week"
            dataKey="previous"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
            fill="rgba(255,255,255,0.0)"
            fillOpacity={0}
            dot={false}
          />

          {/* This week — accent blue with fill */}
          <Radar
            name="This week"
            dataKey="current"
            stroke="#2563EB"
            strokeWidth={2}
            fill="#2563EB"
            fillOpacity={0.15}
            dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
          />

          <Legend content={<CustomLegend />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
