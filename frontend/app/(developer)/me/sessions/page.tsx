'use client'

import { useState, useMemo } from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { EmptyState, SessionDetailDrawer, Pagination, FilterSelect, TruncationNotice } from '@/components/shared'
import { SessionCard } from '@/components/developer/SessionCard'
import { useDeveloperSessions, AGGREGATE_LIMIT } from '@/lib/queries/sessions'
import { isWithinDays, paginate } from '@/lib/utils'

// ─── Filter helpers ───────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { label: 'Last 7 days',  value: '7'   },
  { label: 'Last 30 days', value: '30'  },
  { label: 'Last 90 days', value: '90'  },
  { label: 'All loaded',   value: 'all' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MySessionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Filters
  const [dateRange,  setDateRange]  = useState('30')
  const [projectFilter, setProject] = useState('')
  const [agentFilter,   setAgent]   = useState('')
  const [page, setPage]             = useState(1)

  const { data: sessData, isLoading, isError } = useDeveloperSessions(1, AGGREGATE_LIMIT)
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
  const { totalPages, safePage, visible } = paginate(filtered, page)

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1) }
  }

  const hasFilters = dateRange !== '30' || projectFilter || agentFilter

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Sessions</h1>
        <EmptyState
          icon={AlertTriangle}
          heading="Couldn’t load your sessions"
          subtext="Something went wrong reaching the server. Refresh to try again."
        />
      </div>
    )
  }

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
          <TruncationNotice
            shown={allSessions.length}
            limit={AGGREGATE_LIMIT}
            className="mt-0.5 text-xs"
          />
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

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            onPageChange={setPage}
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
