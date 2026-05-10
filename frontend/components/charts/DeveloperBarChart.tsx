'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'
import { scoreLevel } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeveloperScorePoint {
  name:  string   // developer display name
  score: number   // 0-100 avg score
}

interface Props {
  data:       DeveloperScorePoint[]
  height?:    number
  isLoading?: boolean
}

// ─── Bar color by score level ─────────────────────────────────────────────────

function barColor(score: number): string {
  const level = scoreLevel(score)
  switch (level) {
    case 'high': return 'rgba(22,163,74,0.7)'
    case 'mid':  return 'rgba(217,119,6,0.7)'
    case 'low':  return 'rgba(220,38,38,0.7)'
  }
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value ?? 0

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
        {typeof score === 'number' ? Math.round(score) : '–'}
        <span style={{ color: 'var(--text-faint)', fontFamily: 'inherit', fontWeight: 400 }}> avg score</span>
      </p>
    </div>
  )
}

// ─── Tick with truncation ─────────────────────────────────────────────────────

function NameTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const name    = payload?.value ?? ''
  const display = name.split(' ')[0]  // first name only to save space
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="var(--text-faint)"
      fontSize={11}
    >
      {display}
    </text>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export function DeveloperBarChart({ data, height = 220, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div
        className="animate-pulse rounded"
        style={{ height, background: 'var(--surface-2)' }}
      />
    )
  }

  // Sort descending by score, cap at 8 entries
  const sorted = [...data].sort((a, b) => b.score - a.score).slice(0, 8)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={false}
          />

          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickCount={5}
          />

          <YAxis
            type="category"
            dataKey="name"
            width={60}
            tick={<NameTick />}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip content={CustomTooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

          <Bar dataKey="score" radius={[0, 2, 2, 0]}>
            {sorted.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={barColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
