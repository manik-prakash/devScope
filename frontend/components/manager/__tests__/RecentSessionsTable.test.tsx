import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { RecentSessionsTable } from '../RecentSessionsTable'
import type { Session } from '@/lib/types'

afterEach(cleanup)

const row = {
  id: 's1',
  agent: 'claude',
  score: 82,
  durationMs: '5000',
  createdAt: new Date().toISOString(),
  user: { name: 'Ada Lovelace' },
  project: { name: 'Web Platform' },
} as unknown as Session

describe('RecentSessionsTable', () => {
  it('shows an error state, not "No sessions yet", when isError', () => {
    render(<RecentSessionsTable sessions={[]} isLoading={false} isError onSelectSession={() => {}} />)
    expect(screen.getByText(/couldn’t load recent sessions/i)).toBeInTheDocument()
    expect(screen.queryByText(/no sessions yet/i)).not.toBeInTheDocument()
  })

  it('renders the loading skeleton while isLoading', () => {
    const { container } = render(
      <RecentSessionsTable sessions={[]} isLoading isError={false} onSelectSession={() => {}} />,
    )
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  it('shows the empty state when there are no sessions and no error', () => {
    render(<RecentSessionsTable sessions={[]} isLoading={false} onSelectSession={() => {}} />)
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument()
  })

  it('renders a row per session and fires onSelectSession on click', () => {
    const onSelect = vi.fn()
    render(<RecentSessionsTable sessions={[row]} isLoading={false} onSelectSession={onSelect} />)
    const cell = screen.getByText('Ada Lovelace')
    expect(cell).toBeInTheDocument()
    fireEvent.click(cell)
    expect(onSelect).toHaveBeenCalledWith('s1')
  })
})
