'use client'

import { clamp } from '@/lib/utils'

interface PaginationProps {
  page:          number
  totalPages:    number
  onPageChange:  (next: number) => void
  /** Optional "· N items" suffix next to "Page X of Y". */
  total?:        number
  totalLabel?:   string
  /** Wrapper classes — screens pass their own layout context. */
  className?:    string
}

const BTN =
  'h-7 rounded border px-3 text-xs transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed'
const BTN_STYLE = { borderColor: 'var(--border)', color: 'var(--text-muted)' } as const

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  totalLabel = 'sessions',
  className = 'flex items-center justify-between py-2',
}: PaginationProps) {
  if (totalPages <= 1) return null

  const go = (delta: number) => onPageChange(clamp(page + delta, 1, totalPages))

  return (
    <div className={className} style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Page {page} of {totalPages}
        {total !== undefined && (
          <>
            <span className="mx-2">·</span>
            <span className="font-mono">{total}</span> {totalLabel}
          </>
        )}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => go(-1)}
          disabled={page <= 1}
          className={BTN}
          style={BTN_STYLE}
          onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Previous
        </button>
        <button
          onClick={() => go(1)}
          disabled={page >= totalPages}
          className={BTN}
          style={BTN_STYLE}
          onMouseEnter={(e) => { if (page < totalPages) e.currentTarget.style.background = 'var(--surface-2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
