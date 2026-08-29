'use client'

import { useState, useMemo } from 'react'
import { Download, Activity, AlertTriangle } from 'lucide-react'
import { PageHeader, EmptyState, SessionDetailDrawer } from '@/components/shared'
import { SessionsTable } from '@/components/manager/SessionsTable'
import { useManagerSessions, AGGREGATE_LIMIT } from '@/lib/queries/sessions'
import { isWithinDays } from '@/lib/utils'
import type { Session } from '@/lib/types'

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(sessions: Session[]) {
  const headers = [
    'Session ID', 'Developer', 'Email', 'Project',
    'Agent', 'Agent Version', 'Score', 'Status',
    'Duration (ms)', 'Started At', 'CLI Version',
  ]

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = sessions.map((s) => [
    s.id,
    s.user?.name   ?? '',
    s.user?.email  ?? '',  // note: email may not be present in manager sessions response
    s.project?.name ?? '',
    s.agent,
    s.agentVersion,
    s.score ?? '',
    s.evaluationStatus,
    s.durationMs,
    s.startedAt,
    s.cliVersion,
  ].map(escape))

  const csv  = [headers.map(escape), ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Date range options ───────────────────────────────────────────────────────

type DateRange = '7' | '30' | '90' | 'all'

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days',  value: '7'   },
  { label: 'Last 30 days', value: '30'  },
  { label: 'Last 90 days', value: '90'  },
  { label: 'All loaded',   value: 'all' },
]

// ─── Filter select ────────────────────────────────────────────────────────────

interface FilterSelectProps {
  value:    string
  onChange: (v: string) => void
  options:  { label: string; value: string }[]
  placeholder?: string
}

function FilterSelect({ value, onChange, options, placeholder = 'All' }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded border px-3 text-sm outline-none transition-colors duration-150 cursor-pointer"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        color:       value ? 'var(--text)' : 'var(--text-muted)',
        minWidth:    '140px',
      }}
      onFocus={(e)  => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={(e)   => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ─── Score range input ────────────────────────────────────────────────────────

interface ScoreInputProps {
  value:       string
  onChange:    (v: string) => void
  placeholder: string
}

function ScoreInput({ value, onChange, placeholder }: ScoreInputProps) {
  return (
    <input
      type="number"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-20 rounded border px-3 text-sm outline-none transition-colors duration-150"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        color:       'var(--text)',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

// ─── Page constants ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  // Data
  const { data: sessData, isLoading, isError } = useManagerSessions(1, AGGREGATE_LIMIT)
  const allSessions                   = sessData?.sessions ?? []

  // Drawer
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Filters
  const [dateRange, setDateRange]       = useState<string>('30')
  const [projectFilter, setProject]     = useState('')
  const [developerFilter, setDeveloper] = useState('')
  const [agentFilter, setAgent]         = useState('')
  const [scoreMin, setScoreMin]         = useState('')
  const [scoreMax, setScoreMax]         = useState('')

  // Pagination
  const [page, setPage] = useState(1)

  // ── Derive filter options from data ──────────────────────────────────────────
  const projectOptions = useMemo(() => {
    const names = [...new Set(allSessions.map((s) => s.project?.name).filter(Boolean) as string[])]
    return names.sort().map((n) => ({ label: n, value: n }))
  }, [allSessions])

  const developerOptions = useMemo(() => {
    const names = [...new Set(allSessions.map((s) => s.user?.name).filter(Boolean) as string[])]
    return names.sort().map((n) => ({ label: n, value: n }))
  }, [allSessions])

  const agentOptions = useMemo(() => {
    const agents = [...new Set(allSessions.map((s) => s.agent))]
    return agents.sort().map((a) => ({ label: a, value: a }))
  }, [allSessions])

  // ── Apply filters ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = allSessions

    // Date range
    if (dateRange && dateRange !== 'all') {
      result = result.filter((s) => isWithinDays(s.startedAt, parseInt(dateRange, 10)))
    }

    // Project
    if (projectFilter) {
      result = result.filter((s) => s.project?.name === projectFilter)
    }

    // Developer
    if (developerFilter) {
      result = result.filter((s) => s.user?.name === developerFilter)
    }

    // Agent
    if (agentFilter) {
      result = result.filter((s) => s.agent === agentFilter)
    }

    // Score range
    const min = scoreMin !== '' ? parseInt(scoreMin, 10) : null
    const max = scoreMax !== '' ? parseInt(scoreMax, 10) : null
    if (min !== null) result = result.filter((s) => s.score !== null && s.score >= min)
    if (max !== null) result = result.filter((s) => s.score !== null && s.score <= max)

    return result
  }, [allSessions, dateRange, projectFilter, developerFilter, agentFilter, scoreMin, scoreMax])

  // Reset to page 1 when filters change — handled by key deps above

  // ── Client-side pagination ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      setPage(1)  // reset to first page on any filter change
    }
  }

  const hasActiveFilters =
    dateRange !== '30' || projectFilter || developerFilter || agentFilter || scoreMin || scoreMax

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        subtitle={
          isLoading
            ? undefined
            : `${filtered.length.toLocaleString()} session${filtered.length !== 1 ? 's' : ''}${hasActiveFilters ? ' (filtered)' : ''}`
        }
        action={
          <button
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex h-9 items-center gap-2 rounded border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              if (filtered.length > 0) {
                e.currentTarget.style.background   = 'var(--surface-2)'
                e.currentTarget.style.borderColor  = 'var(--border-hover)'
                e.currentTarget.style.color        = 'var(--text)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = 'transparent'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color       = 'var(--text-muted)'
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
        }
      />

      {!isLoading && allSessions.length >= AGGREGATE_LIMIT && (
        <p className="-mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>
          Filters, counts and CSV export cover the {AGGREGATE_LIMIT.toLocaleString()} most
          recent sessions, not the full history.
        </p>
      )}

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={dateRange}
          onChange={handleFilterChange(setDateRange)}
          options={DATE_RANGE_OPTIONS}
          placeholder="Date range"
        />
        <FilterSelect
          value={projectFilter}
          onChange={handleFilterChange(setProject)}
          options={projectOptions}
          placeholder="All projects"
        />
        <FilterSelect
          value={developerFilter}
          onChange={handleFilterChange(setDeveloper)}
          options={developerOptions}
          placeholder="All developers"
        />
        <FilterSelect
          value={agentFilter}
          onChange={handleFilterChange(setAgent)}
          options={agentOptions}
          placeholder="All agents"
        />

        {/* Score range */}
        <div className="flex items-center gap-2">
          <ScoreInput
            value={scoreMin}
            onChange={handleFilterChange(setScoreMin)}
            placeholder="Min"
          />
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>–</span>
          <ScoreInput
            value={scoreMax}
            onChange={handleFilterChange(setScoreMax)}
            placeholder="Max"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setDateRange('30')
              setProject('')
              setDeveloper('')
              setAgent('')
              setScoreMin('')
              setScoreMax('')
              setPage(1)
            }}
            className="text-xs transition-colors duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div
        className="rounded border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {isError ? (
          <EmptyState
            icon={AlertTriangle}
            heading="Couldn’t load sessions"
            subtext="Something went wrong reaching the server. Refresh to try again."
          />
        ) : isLoading ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded"
                style={{ background: 'var(--surface-2)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Activity}
            heading="No sessions match your filters"
            subtext="Try adjusting the filters above or clearing them to see all sessions."
          />
        ) : (
          <>
            <SessionsTable sessions={visible} onSelectSession={setSelectedSessionId} />

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between border-t px-4 py-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Page {safePage} of {totalPages}
                  <span className="ml-2">·</span>
                  <span className="ml-2 font-mono">{filtered.length}</span>
                  <span className="ml-1">results</span>
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                      if (safePage > 1) e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    Previous
                  </button>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                      if (safePage < totalPages) e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SessionDetailDrawer
        sessionId={selectedSessionId}
        viewerRole="manager"
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  )
}
