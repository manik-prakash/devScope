'use client'

import { useState, useMemo } from 'react'
import { Activity } from 'lucide-react'
import { EmptyState, SessionDetailDrawer } from '@/components/shared'
import { SessionCard } from '@/components/developer/SessionCard'
import { useDeveloperSessions } from '@/lib/queries/sessions'
import { isWithinDays } from '@/lib/utils'

// ─── Filter helpers ───────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { label: 'Last 7 days',  value: '7'   },
  { label: 'Last 30 days', value: '30'  },
  { label: 'Last 90 days', value: '90'  },
  { label: 'All time',     value: 'all' },
]

interface FilterSelectProps {
  value:       string
  onChange:    (v: string) => void
  options:     { label: string; value: string }[]
  placeholder: string
}

function FilterSelect({ value, onChange, options, placeholder }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded border px-3 text-sm outline-none transition-colors duration-150 cursor-pointer"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        color:       value ? 'var(--text)' : 'var(--text-muted)',
        minWidth:    '130px',
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

// ─── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

interface PaginationBarProps {
  page:       number
  totalPages: number
  total:      number
  onPrev:     () => void
  onNext:     () => void
}

function PaginationBar({ page, totalPages, total, onPrev, onNext }: PaginationBarProps) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Page {page} of {totalPages}
        <span className="mx-2">·</span>
        <span className="font-mono">{total}</span> sessions
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { if (page < totalPages) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MySessionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Filters
  const [dateRange,  setDateRange]  = useState('30')
  const [projectFilter, setProject] = useState('')
  const [agentFilter,   setAgent]   = useState('')
  const [page, setPage]             = useState(1)

  const { data: sessData, isLoading } = useDeveloperSessions(1, 200)
  const allSessions                   = sessData?.sessions ?? []

  // ── Derive filter options ──────────────────────────────────────────────────
  const projectOptions = useMemo(() => {
    const names = [
      ...new Set(allSessions.map((s) => s.project?.name).filter(Boolean) as string[]),
    ]
    return names.sort().map((n) => ({ label: n, value: n }))
  }, [allSessions])

  const agentOptions = useMemo(() => {
    const agents = [...new Set(allSessions.map((s) => s.agent))]
    return agents.sort().map((a) => ({ label: a, value: a }))
  }, [allSessions])

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = allSessions

    if (dateRange && dateRange !== 'all') {
      result = result.filter((s) => isWithinDays(s.startedAt, parseInt(dateRange, 10)))
    }
    if (projectFilter) {
      result = result.filter((s) => s.project?.name === projectFilter)
    }
    if (agentFilter) {
      result = result.filter((s) => s.agent === agentFilter)
    }

    return result
  }, [allSessions, dateRange, projectFilter, agentFilter])

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1) }
  }

  const hasFilters = dateRange !== '30' || projectFilter || agentFilter

  // ── Loading skeletons ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Sessions</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Sessions
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} session{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={dateRange}
          onChange={handleFilterChange(setDateRange)}
          options={DATE_OPTIONS}
          placeholder="Date range"
        />
        <FilterSelect
          value={projectFilter}
          onChange={handleFilterChange(setProject)}
          options={projectOptions}
          placeholder="All projects"
        />
        <FilterSelect
          value={agentFilter}
          onChange={handleFilterChange(setAgent)}
          options={agentOptions}
          placeholder="All agents"
        />
        {hasFilters && (
          <button
            onClick={() => {
              setDateRange('30')
              setProject('')
              setAgent('')
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

      {/* Cards or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          heading={allSessions.length === 0 ? 'No sessions yet' : 'No sessions match your filters'}
          subtext={
            allSessions.length === 0
              ? 'Run devscope run claude code to capture your first session.'
              : 'Try adjusting or clearing the filters above.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      <SessionDetailDrawer
        sessionId={selectedId}
        viewerRole="developer"
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
